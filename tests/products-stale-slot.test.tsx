// @vitest-environment jsdom
//
// Security-audit Fix 1 (stale text snapshot, silent wrong-slot write):
// EditableField used to freeze `text` into a ref at mount and never
// re-sync it. Combined with index-based React keys in list rendering, an
// array mutation (e.g. removing a middle tag) reused the same component
// instance at a given index, so that slot kept displaying the OLD,
// possibly-deleted value while its `path` prop (also index-derived) had
// already moved on to whatever shifted into that slot - editing the
// visible-but-stale text would silently write into the WRONG field.
//
// This file renders the real `Products` component (not a synthetic
// harness) so the fix is verified exactly where the audit found the bug:
// Editable.tsx's `key={text}` remount-on-change plus Products.tsx's
// content-aware `tagKeys`, not just the underlying primitive in isolation.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Content } from '@/lib/content/schema'

const getEditorState = vi.fn()
vi.mock('@/app/actions/content', () => ({
  getEditorState: (...args: unknown[]) => getEditorState(...args),
  saveField: vi.fn(),
  saveArray: vi.fn(),
  revertLastSave: vi.fn(),
}))

vi.mock('@/app/actions/auth', () => ({
  signOutAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { EditProvider } from '@/components/editor/EditProvider'
import { Products } from '@/components/sections/Products'

const HINT_KEY = 'bgm-editor'

function productWithTags(tags: string[]): Content['products'][number] {
  return {
    id: 'product-1',
    name: 'Widget',
    tagline: 'Does the thing',
    body: 'A body describing the thing.',
    tags,
    links: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
  // Products renders Reveal/WrittenHeading, both of which use
  // IntersectionObserver (absent in jsdom); see tests/written-heading.test.tsx
  // for the same stub.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
})

/** Mirrors tests/editable.test.tsx's renderEditing helper. */
async function renderEditingProducts(tags: string[], updatedAt = 'T1') {
  window.localStorage.setItem(HINT_KEY, '1')
  getEditorState.mockResolvedValue({ ok: true, updatedAt })
  const utils = render(
    <EditProvider>
      <Products products={[productWithTags(tags)]} kicker="Kicker" />
    </EditProvider>,
  )
  const toggle = await screen.findByRole('button', { name: /edit page/i })
  fireEvent.click(toggle)
  return utils
}

function tagTextbox(index: number) {
  return screen.getByRole('textbox', { name: `Edit products.0.tags.${index}` })
}

async function renderEditingProduct(name: string, updatedAt = 'T1') {
  window.localStorage.setItem(HINT_KEY, '1')
  getEditorState.mockResolvedValue({ ok: true, updatedAt })
  const utils = render(
    <EditProvider>
      <Products
        products={[{ ...productWithTags([]), name }]}
        kicker="Kicker"
      />
    </EditProvider>,
  )
  const toggle = await screen.findByRole('button', { name: /edit page/i })
  fireEvent.click(toggle)
  return utils
}

describe('Products tags list: stale-slot regression (audit Fix 1)', () => {
  it('a post-removal refresh shows exactly the remaining tags, never a stale removed one', async () => {
    const { rerender } = await renderEditingProducts(['A', 'B', 'C'])

    expect(tagTextbox(0).textContent).toBe('A')
    expect(tagTextbox(1).textContent).toBe('B')
    expect(tagTextbox(2).textContent).toBe('C')

    // Simulate the post-removal router.refresh(): the same tree re-renders
    // with tag B (the middle one) removed from the array, exactly like a
    // server component receiving fresh props after another admin action.
    rerender(
      <EditProvider>
        <Products products={[productWithTags(['A', 'C'])]} kicker="Kicker" />
      </EditProvider>,
    )

    const tagboxes = screen.getAllByRole('textbox', { name: /^Edit products\.0\.tags\.\d+$/ })
    const texts = tagboxes.map((el) => el.textContent)

    // The whole point: exactly the current array, in order, never a
    // leftover "B" occupying a slot that now belongs to a different tag.
    expect(texts).toEqual(['A', 'C'])
    expect(texts).not.toContain('B')
    expect(screen.queryByText('B')).toBeNull()
  })

  it('path/text pairing stays consistent after the change: slot 1 reads C\'s own path, not a stale one', async () => {
    const { rerender } = await renderEditingProducts(['A', 'B', 'C'])

    rerender(
      <EditProvider>
        <Products products={[productWithTags(['A', 'C'])]} kicker="Kicker" />
      </EditProvider>,
    )

    // Editing "whatever is visually in slot 1" must write to the path that
    // actually holds that value now (products.0.tags.1 = "C"), not silently
    // clobber a different array slot the way the pre-fix bug did.
    const slot1 = tagTextbox(1)
    expect(slot1.textContent).toBe('C')
    expect(slot1.getAttribute('data-editable')).toBe('products.0.tags.1')

    // And there is no dangling third slot still claiming to be tags.2.
    expect(screen.queryByRole('textbox', { name: 'Edit products.0.tags.2' })).toBeNull()
  })
})

// The two tests above go through Products.tsx's own content-aware tagKeys,
// which independently forces a remount on tag removal (a tag's list key IS
// its content) - so together they do not, on their own, prove
// Editable.tsx's OWN `key={text}` fix (on EditableField, inside `Editable`)
// is what is doing the work. This block isolates that mechanism: the
// product's `id` (and so the id-keyed `<Reveal>`/`<TapedCard>` subtree
// wrapping the whole card, including the name field) does NOT change here,
// only the name's own text does - exactly a revert, or a second admin's
// edit, landing via router.refresh() while this field is mounted but not
// focused. Nothing above EditableField in this tree remounts, so this can
// only pass if EditableField itself re-syncs.
describe('Product name field: text-prop resync without any array remount (isolates the Editable.tsx fix)', () => {
  it('a name that changes while its product keeps the same id is reflected, not left stale', async () => {
    const { rerender } = await renderEditingProduct('Widget')
    expect(screen.getByRole('textbox', { name: 'Edit products.0.name' }).textContent).toBe('Widget')

    rerender(
      <EditProvider>
        <Products products={[{ ...productWithTags([]), name: 'Widget Pro' }]} kicker="Kicker" />
      </EditProvider>,
    )

    expect(screen.getByRole('textbox', { name: 'Edit products.0.name' }).textContent).toBe('Widget Pro')
  })
})
