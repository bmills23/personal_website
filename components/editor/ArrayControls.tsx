'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveArray, type SaveResult } from '@/app/actions/content'
import { ARRAY_LIMITS } from '@/lib/content/schema'
import { newProduct, newTrackEntry, uniqueId } from '@/lib/editor/templates'
import { saveErrorMessage, useEditor, type SaveStatus } from './EditProvider'

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
  /** The array an op actually reads/splices: `items` itself for a
   * product/entry op, or the owning product's `tags` array for a tag op. */
  subArray: unknown[]
  /** Folds a new sub-array back into the whole value `saveArray` expects. */
  build: (nextSub: unknown[]) => unknown
}

const TAG_KEY_RE = /^products\.(\d+)\.tags$/

/**
 * Resolves `{ kind, items, arrayKey }` into what an op actually operates on
 * and what `saveArray` ultimately needs.
 *
 * For `'product'`/`'entry'`, `items` IS the array `saveArray` replaces
 * wholesale (the products array, or one track's entries array), so this is
 * the identity: `subArray === items`, `build` is a no-op passthrough.
 *
 * For `'tag'`, the caller passes the FULL products array as `items` (tags
 * have no standalone saveArray key) and an arrayKey shaped
 * `products.${productIndex}.tags`; this pulls out that one product's `tags`
 * array, and `build` folds a new tags array back into a full next-products
 * array with every other product untouched. Does not require `subArray` to
 * be non-empty: a product with zero tags still resolves fine, which is what
 * lets `ArrayAddButton` work on an empty collection.
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

function capFor(kind: ArrayControlsKind): number {
  if (kind === 'product') return ARRAY_LIMITS.products
  if (kind === 'entry') return ARRAY_LIMITS['tracks.entries']
  return ARRAY_LIMITS['products.tags']
}

/**
 * Shared save path for every op in this file (remove, move, add). Routes
 * through `enqueueSave` purely for serialization - so an array op can never
 * race a field commit or another array op for the SAME token slot - but,
 * unlike `commitField` (Editable.tsx) and unlike `EditToolbar`'s revert,
 * deliberately ignores the execution-time token `enqueueSave`'s callback is
 * handed and sends `clickToken` (captured by the caller at click time)
 * instead.
 *
 * Why the asymmetry: a field commit's base is a single leaf, so a token
 * that advanced between this commit being queued and it actually running is
 * still a perfectly valid base for THAT SAME leaf - nothing about the leaf
 * changed just because some other field saved. An array op's base is the
 * WHOLE array read off render-time props at the moment its button was
 * clicked. If a second array op is clicked before the first one's
 * `router.refresh()` has re-rendered those props, both ops compute their
 * next-array payload from the SAME stale array. Taking the execution-time
 * token for the second op would let its stale payload sail through under a
 * token that only proves the array key advanced (not that THIS payload's
 * base is still current) - silently clobbering the first op's change with
 * no error at all. Pinning the token to click time means the second op
 * always carries the token that was actually current when ITS payload was
 * computed, so the server's optimistic-concurrency check
 * (`current.updatedAt !== clientToken` in app/actions/content.ts's
 * `commit()`) correctly rejects it as `'stale'` instead of the staleness
 * being laundered through silently. DO NOT change this back to read the
 * execution-time token argument - see
 * `tests/array-controls-race.test.tsx`, which fails if you do.
 *
 * Click-time pinning (above) only closes the race window for a click that
 * lands WHILE a save is in flight - `savingDisabled` (in the components
 * below) independently closes that same window by disabling every button
 * for its duration, so pinning is the deeper guarantee that holds even
 * where disabling can't reach. Pinning does nothing, though, for the
 * window AFTER a save resolves `ok`: `reportStatus({state:'saved'})`
 * re-enables the buttons immediately, but `router.refresh()` (which
 * re-renders this component with the fresh array as props) lands
 * asynchronously. A second click inside that gap still reads `subArray`
 * off stale props - exactly like the in-flight case - but this time pins a
 * token that IS current (the first save's success already advanced it), so
 * the server accepts it, and the second op's stale-computed payload
 * silently overwrites the first op's change with no error at all.
 * Wrapping `router.refresh()` in `startTransition` closes that
 * post-success window the same way `savingDisabled` closes the in-flight
 * one: `isPending` stays true until the refresh has actually landed and
 * committed, so callers keep buttons disabled across both windows by
 * checking `status.state === 'saving' || isPending`.
 */
async function runArraySave({
  enqueueSave,
  reportStatus,
  router,
  startTransition,
  clickToken,
  saveKey,
  value,
}: {
  enqueueSave: (fn: (token: string) => Promise<SaveResult>) => Promise<SaveResult>
  reportStatus: (status: SaveStatus) => void
  router: { refresh: () => void }
  startTransition: (fn: () => void) => void
  clickToken: string | null
  saveKey: string
  value: unknown
}): Promise<void> {
  if (clickToken === null) {
    reportStatus({ state: 'error', message: saveErrorMessage('server') })
    return
  }
  reportStatus({ state: 'saving' })
  const result = await enqueueSave(() => saveArray({ key: saveKey, value, updatedAt: clickToken }))
  if (result.ok) {
    reportStatus({ state: 'saved' })
    startTransition(() => {
      router.refresh()
    })
  } else {
    reportStatus({ state: 'error', message: saveErrorMessage(result.error) })
    // A stale rejection means server state moved since this payload's base
    // was read; refresh so props re-sync and the owner can just re-click
    // against current data. Other failures (invalid, unauthorized, server)
    // don't imply the visible data is out of date, so they don't refresh.
    if (result.error === 'stale') {
      startTransition(() => {
        router.refresh()
      })
    }
  }
}

/**
 * Compact remove/reorder button row for one item of an editable array (a
 * product card, a work-track entry, or a tag). Renders `null` outside edit
 * mode so a visitor's DOM is never touched - same contract as `Editable`
 * (see Editable.tsx). The "add" control lives in the separate
 * `ArrayAddButton` below, rendered once per collection rather than anchored
 * to this component's last item - see its own doc comment for why.
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
  const { session, editing, enqueueSave, reportStatus, updatedAt, status } = useEditor()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = session === 'admin' && editing

  if (!isEditing) return null

  const { saveKey, subArray, build } = resolveTarget(kind, items, arrayKey)
  const isLast = index === subArray.length - 1
  // Disabling every button while ANY save is in flight (not just this row's
  // own) shrinks the window for the stale-payload race above even further:
  // the click-time-token fix is what makes a race safe, this is what makes
  // one rarer to begin with. `isPending` extends that same disabling
  // through the POST-success window too - `status.state` alone flips back
  // to 'saved' (not 'saving') the instant a save resolves, before
  // `router.refresh()` (wrapped in `startTransition` in `runArraySave`
  // above) has actually re-rendered this component with fresh props - see
  // that function's doc comment for why a click landing in that gap is
  // exactly the same stale-payload hazard as one landing mid-save.
  const savingDisabled = status.state === 'saving' || isPending

  function handleRemove() {
    if (savingDisabled) return
    // Tags are not destructive enough to warrant a confirm (low-stakes,
    // trivially re-added); products and entries are, per the brief.
    if (kind !== 'tag' && !window.confirm(`Remove this ${kind}?`)) return
    void runArraySave({
      enqueueSave,
      reportStatus,
      router,
      startTransition,
      clickToken: updatedAt,
      saveKey,
      value: build(withoutIndex(subArray, index)),
    })
  }

  function handleMoveUp() {
    if (savingDisabled || index === 0) return
    void runArraySave({
      enqueueSave,
      reportStatus,
      router,
      startTransition,
      clickToken: updatedAt,
      saveKey,
      value: build(swapped(subArray, index, index - 1)),
    })
  }

  function handleMoveDown() {
    if (savingDisabled || isLast) return
    void runArraySave({
      enqueueSave,
      reportStatus,
      router,
      startTransition,
      clickToken: updatedAt,
      saveKey,
      value: build(swapped(subArray, index, index + 1)),
    })
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={`Remove ${kind}`}
        className={buttonClass}
        disabled={savingDisabled}
        onClick={handleRemove}
      >
        &#215;
      </button>
      {kind !== 'tag' && (
        <>
          <button
            type="button"
            aria-label={`Move ${kind} up`}
            className={buttonClass}
            disabled={index === 0 || savingDisabled}
            onClick={handleMoveUp}
          >
            &#8593;
          </button>
          <button
            type="button"
            aria-label={`Move ${kind} down`}
            className={buttonClass}
            disabled={isLast || savingDisabled}
            onClick={handleMoveDown}
          >
            &#8595;
          </button>
        </>
      )}
    </span>
  )
}

/**
 * The "add" control for one whole collection - rendered ONCE per collection
 * (once after the products grid, once after each track's entries list, once
 * after each product's tags row), not anchored to any particular item's
 * row. Anchoring "add" to the last item's row (an earlier version of this
 * file did that) means a collection with zero items has no row to hang it
 * off of and so no way to add a first one; that is a real dead end here,
 * not a hypothetical, since every product `newProduct` creates starts with
 * `tags: []`. Rendering this unconditionally (including at zero items)
 * closes that gap for all three kinds.
 *
 * Disabled at the collection's `ARRAY_LIMITS` cap (with an explanatory
 * `title`) rather than letting a click round-trip to the server just to
 * come back as a generic 'invalid' rejection.
 */
export function ArrayAddButton({
  kind,
  items,
  arrayKey,
}: {
  kind: ArrayControlsKind
  items: unknown[]
  arrayKey: string
}) {
  const { session, editing, enqueueSave, reportStatus, updatedAt, status } = useEditor()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = session === 'admin' && editing

  if (!isEditing) return null

  const { saveKey, subArray, build } = resolveTarget(kind, items, arrayKey)
  const cap = capFor(kind)
  const atCap = subArray.length >= cap
  // See the matching comment in ArrayControls above: `isPending` keeps this
  // disabled through the post-success window while `router.refresh()`
  // (wrapped in `startTransition` by `runArraySave`) is still landing, not
  // just while `status.state === 'saving'`.
  const disabled = atCap || status.state === 'saving' || isPending

  function handleAdd() {
    if (disabled) return
    void runArraySave({
      enqueueSave,
      reportStatus,
      router,
      startTransition,
      clickToken: updatedAt,
      saveKey,
      value: build([...subArray, buildTemplate(kind, subArray)]),
    })
  }

  return (
    <button
      type="button"
      aria-label={`Add ${kind}`}
      className={buttonClass}
      disabled={disabled}
      title={atCap ? `Limit reached (${cap} max)` : undefined}
      onClick={handleAdd}
    >
      +
    </button>
  )
}
