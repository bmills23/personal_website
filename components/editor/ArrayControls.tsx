'use client'

import { useRouter } from 'next/navigation'
import { saveArray } from '@/app/actions/content'
import { newProduct, newTrackEntry, uniqueId } from '@/lib/editor/templates'
import { saveErrorMessage, useEditor } from './EditProvider'

export type ArrayControlsKind = 'product' | 'entry' | 'tag'

const buttonClass =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-card-border text-[15px] leading-none text-ink hover:text-stamp disabled:opacity-40 disabled:hover:text-ink'

/** Every op below builds a brand-new array (never mutates `subArray` in
 * place): the result is handed straight to `saveArray`, and `subArray` may
 * itself be a live prop straight from the parent server component's
 * render. */
function withoutIndex<T>(arr: readonly T[], index: number): T[] {
  const next = arr.slice()
  next.splice(index, 1)
  return next
}

function swapped<T>(arr: readonly T[], a: number, b: number): T[] {
  const next = arr.slice()
  const tmp = next[a]
  next[a] = next[b]
  next[b] = tmp
  return next
}

type Target = {
  /** The literal `saveArray` key: `'products'` or `'tracks.N.entries'`.
   * Always `'products'` for a tag op, since tags live inside products and
   * `lib/content/write.ts`'s `ARRAY_KEY_RE` has no standalone
   * `'products.N.tags'` key - only a whole-products-array replacement. */
  saveKey: string
  /** The array `index` actually indexes into: `items` itself for a
   * product/entry op, or the owning product's `tags` array for a tag op. */
  subArray: unknown[]
  /** Folds a new sub-array back into the whole value `saveArray` expects. */
  build: (nextSub: unknown[]) => unknown
}

const TAG_KEY_RE = /^products\.(\d+)\.tags$/

/**
 * Resolves `{ kind, items, arrayKey }` into what a splice actually operates
 * on and what `saveArray` ultimately needs.
 *
 * For `'product'`/`'entry'`, `items` IS the array `saveArray` replaces
 * wholesale (the products array, or one track's entries array), so this is
 * the identity: `subArray === items`, `build` is a no-op passthrough.
 *
 * For `'tag'`, the caller passes the FULL products array as `items` (tags
 * have no standalone saveArray key) and an arrayKey shaped
 * `products.${productIndex}.tags`; this pulls out that one product's `tags`
 * array to splice, and `build` folds a new tags array back into a full
 * next-products array with every other product untouched.
 */
function resolveTarget(kind: ArrayControlsKind, items: unknown[], arrayKey: string): Target {
  if (kind === 'tag') {
    const match = TAG_KEY_RE.exec(arrayKey)
    if (!match) {
      throw new Error(`ArrayControls: invalid arrayKey "${arrayKey}" for kind "tag"`)
    }
    const productIndex = Number(match[1])
    const products = items as { tags: unknown[] }[]
    const product = products[productIndex]
    if (!product) {
      throw new Error(`ArrayControls: no product at index ${productIndex} for arrayKey "${arrayKey}"`)
    }
    return {
      saveKey: 'products',
      subArray: product.tags,
      build: (nextTags) => products.map((p, i) => (i === productIndex ? { ...p, tags: nextTags } : p)),
    }
  }
  return { saveKey: arrayKey, subArray: items, build: (next) => next }
}

function buildTemplate(kind: ArrayControlsKind, subArray: unknown[]): unknown {
  if (kind === 'product') {
    return newProduct((subArray as { id: string }[]).map((item) => item.id))
  }
  if (kind === 'entry') {
    return newTrackEntry((subArray as { id: string }[]).map((item) => item.id))
  }
  return uniqueId('tag', subArray as string[])
}

/**
 * Compact add/remove/reorder button row for one item of an editable array
 * (a product card, a work-track entry, or a tag). Renders `null` outside
 * edit mode so a visitor's DOM is never touched - same contract as
 * `Editable` (see Editable.tsx).
 *
 * Every operation builds the whole next array client-side (a splice copy
 * of the current, already-rendered props) and saves it through
 * `enqueueSave`, so an array op can never race a field commit or another
 * array op for the same token, exactly like `commitField` does for a
 * field (see Editable.tsx / EditProvider.tsx). Unlike `commitField`, a
 * failure here has no local DOM draft to restore - the section always
 * renders straight from server props - so the failure branch only reports
 * the mapped error; a later refresh (this one's success or any other) is
 * what re-syncs the page.
 */
export function ArrayControls({
  kind,
  items,
  index,
  arrayKey,
}: {
  kind: ArrayControlsKind
  items: unknown[]
  index: number
  arrayKey: string
}) {
  const { session, editing, enqueueSave, reportStatus } = useEditor()
  const router = useRouter()
  const isEditing = session === 'admin' && editing

  if (!isEditing) return null

  const { saveKey, subArray, build } = resolveTarget(kind, items, arrayKey)
  const isLast = index === subArray.length - 1

  async function commit(nextSub: unknown[]) {
    reportStatus({ state: 'saving' })
    const result = await enqueueSave((token) =>
      saveArray({ key: saveKey, value: build(nextSub), updatedAt: token }),
    )
    if (result.ok) {
      reportStatus({ state: 'saved' })
      router.refresh()
    } else {
      reportStatus({ state: 'error', message: saveErrorMessage(result.error) })
    }
  }

  function handleRemove() {
    // Tags are not destructive enough to warrant a confirm (low-stakes,
    // trivially re-added); products and entries are, per the brief.
    if (kind !== 'tag' && !window.confirm(`Remove this ${kind}?`)) return
    void commit(withoutIndex(subArray, index))
  }

  function handleMoveUp() {
    if (index === 0) return
    void commit(swapped(subArray, index, index - 1))
  }

  function handleMoveDown() {
    if (isLast) return
    void commit(swapped(subArray, index, index + 1))
  }

  function handleAdd() {
    void commit([...subArray, buildTemplate(kind, subArray)])
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" aria-label={`Remove ${kind}`} className={buttonClass} onClick={handleRemove}>
        &#215;
      </button>
      {kind !== 'tag' && (
        <>
          <button
            type="button"
            aria-label={`Move ${kind} up`}
            className={buttonClass}
            disabled={index === 0}
            onClick={handleMoveUp}
          >
            &#8593;
          </button>
          <button
            type="button"
            aria-label={`Move ${kind} down`}
            className={buttonClass}
            disabled={isLast}
            onClick={handleMoveDown}
          >
            &#8595;
          </button>
        </>
      )}
      {isLast && (
        <button type="button" aria-label={`Add ${kind}`} className={buttonClass} onClick={handleAdd}>
          +
        </button>
      )}
    </span>
  )
}
