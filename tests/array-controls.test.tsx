// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const getEditorState = vi.fn()
const saveArray = vi.fn()
vi.mock('@/app/actions/content', () => ({
  getEditorState: (...args: unknown[]) => getEditorState(...args),
  saveArray: (...args: unknown[]) => saveArray(...args),
}))

const signOutAction = vi.fn()
vi.mock('@/app/actions/auth', () => ({
  signOutAction: (...args: unknown[]) => signOutAction(...args),
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

import { EditProvider } from '@/components/editor/EditProvider'
import { ArrayControls, ArrayAddButton } from '@/components/editor/ArrayControls'

const HINT_KEY = 'bgm-editor'

const products = [
  { id: 'p1', name: 'Alpha', tagline: 'a tag', body: 'a body', tags: ['x', 'y'], links: [] },
  { id: 'p2', name: 'Beta', tagline: 'b tag', body: 'b body', tags: [], links: [] },
]

const entries = [
  { id: 'e1', org: 'Org A', role: 'Role A', period: 'Present', body: '' },
  { id: 'e2', org: 'Org B', role: 'Role B', period: 'Past', body: '' },
]

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

/** Mirrors tests/editable.test.tsx's renderEditing helper exactly. */
async function renderEditing(children: React.ReactNode, updatedAt = 'T1') {
  window.localStorage.setItem(HINT_KEY, '1')
  getEditorState.mockResolvedValue({ ok: true, updatedAt })
  const utils = render(<EditProvider>{children}</EditProvider>)
  const toggle = await screen.findByRole('button', { name: /edit page/i })
  fireEvent.click(toggle)
  return utils
}

describe('ArrayControls view mode', () => {
  it('renders null outside edit mode', () => {
    const { container } = render(
      <EditProvider>
        <ArrayControls kind="product" items={products} index={0} arrayKey="products" />
      </EditProvider>,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('ArrayControls: products', () => {
  it('remove on index 0 with confirm=true calls saveArray with the array minus item 0', async () => {
    saveArray.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderEditing(
      <ArrayControls kind="product" items={products} index={0} arrayKey="products" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove product' }))

    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))
    expect(saveArray).toHaveBeenCalledWith({
      key: 'products',
      value: [products[1]],
      updatedAt: 'T1',
    })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('confirm=false saves nothing on remove', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderEditing(
      <ArrayControls kind="product" items={products} index={0} arrayKey="products" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove product' }))

    await Promise.resolve()
    expect(saveArray).not.toHaveBeenCalled()
  })

  it('move down on index 0 swaps items 0 and 1', async () => {
    saveArray.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    await renderEditing(
      <ArrayControls kind="product" items={products} index={0} arrayKey="products" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Move product down' }))

    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))
    expect(saveArray).toHaveBeenCalledWith({
      key: 'products',
      value: [products[1], products[0]],
      updatedAt: 'T1',
    })
  })

  it('move up is disabled at index 0 and move down is disabled at the last index', async () => {
    await renderEditing(
      <>
        <ArrayControls kind="product" items={products} index={0} arrayKey="products" />
        <ArrayControls kind="product" items={products} index={1} arrayKey="products" />
      </>,
    )
    const [upFirst, downFirst] = [
      screen.getAllByRole('button', { name: 'Move product up' })[0],
      screen.getAllByRole('button', { name: 'Move product down' })[0],
    ]
    const [upLast, downLast] = [
      screen.getAllByRole('button', { name: 'Move product up' })[1],
      screen.getAllByRole('button', { name: 'Move product down' })[1],
    ]
    expect((upFirst as HTMLButtonElement).disabled).toBe(true)
    expect((downFirst as HTMLButtonElement).disabled).toBe(false)
    expect((upLast as HTMLButtonElement).disabled).toBe(false)
    expect((downLast as HTMLButtonElement).disabled).toBe(true)
  })

  it('ArrayControls never renders an Add button (moved to ArrayAddButton)', async () => {
    await renderEditing(
      <ArrayControls kind="product" items={products} index={1} arrayKey="products" />,
    )
    expect(screen.queryByRole('button', { name: 'Add product' })).toBeNull()
  })

  it('a stale failure reports the mapped message and calls refresh so props resync', async () => {
    saveArray.mockResolvedValue({ ok: false, error: 'stale' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderEditing(
      <ArrayControls kind="product" items={products} index={0} arrayKey="products" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove product' }))

    await waitFor(() =>
      expect(screen.getByText('This page changed elsewhere. Reload before editing.')).toBeTruthy(),
    )
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('a non-stale failure reports the mapped message and does not refresh', async () => {
    saveArray.mockResolvedValue({ ok: false, error: 'invalid' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderEditing(
      <ArrayControls kind="product" items={products} index={0} arrayKey="products" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove product' }))

    await waitFor(() =>
      expect(screen.getByText('Not saved: that value is not allowed.')).toBeTruthy(),
    )
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('ArrayControls: disabled while a save is in flight', () => {
  it('remove/move buttons are disabled for the duration of any in-flight save', async () => {
    let resolveSave: (value: { ok: true; updatedAt: string }) => void = () => {}
    saveArray.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        }),
    )
    await renderEditing(
      <ArrayControls kind="product" items={products} index={1} arrayKey="products" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Move product up' }))
    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))

    expect((screen.getByRole('button', { name: 'Remove product' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(
      (screen.getByRole('button', { name: 'Move product up' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Move product down' }) as HTMLButtonElement).disabled,
    ).toBe(true)

    resolveSave({ ok: true, updatedAt: 'T2' })
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Remove product' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    )
  })
})

// The click-time-token mechanism itself (op B pinned to the token from its
// OWN click, not a fresher one the first op's success later produces) is
// covered in tests/array-controls-race.test.tsx, not here. Once buttons are
// disabled while status.state === 'saving' (the sibling describe block
// above), a real second click on any ArrayControls button in ONE
// <EditProvider> tree while another is in flight cannot reach its handler
// at all (verified: a disabled button's onClick never fires, even via
// fireEvent.click) - so demonstrating the token fix requires controlling
// the editor context directly rather than two sequential DOM clicks through
// the real provider. See that file's header comment for the full
// rationale.

describe('ArrayControls: track entries', () => {
  it('remove asks for confirmation and saves to the tracks.N.entries key', async () => {
    saveArray.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderEditing(
      <ArrayControls kind="entry" items={entries} index={1} arrayKey="tracks.0.entries" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove entry' }))

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))
    expect(saveArray).toHaveBeenCalledWith({
      key: 'tracks.0.entries',
      value: [entries[0]],
      updatedAt: 'T1',
    })
  })
})

describe('ArrayControls: tags', () => {
  it('remove never confirms, and saves the whole products array with just this tag spliced out', async () => {
    saveArray.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderEditing(
      <ArrayControls kind="tag" items={products} index={0} arrayKey="products.0.tags" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag' }))

    expect(confirmSpy).not.toHaveBeenCalled()
    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))
    expect(saveArray).toHaveBeenCalledWith({
      key: 'products',
      value: [{ ...products[0], tags: ['y'] }, products[1]],
      updatedAt: 'T1',
    })
  })

  it('renders only remove (no move buttons, no add button)', async () => {
    await renderEditing(
      <>
        <ArrayControls kind="tag" items={products} index={0} arrayKey="products.0.tags" />
        <ArrayControls kind="tag" items={products} index={1} arrayKey="products.0.tags" />
      </>,
    )
    expect(screen.queryByRole('button', { name: /^Move tag (up|down)$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add tag' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Remove tag' })).toHaveLength(2)
  })
})

describe('ArrayAddButton view mode', () => {
  it('renders null outside edit mode', () => {
    const { container } = render(
      <EditProvider>
        <ArrayAddButton kind="product" items={products} arrayKey="products" />
      </EditProvider>,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('ArrayAddButton: zero-item collections (the dead-end this fixes)', () => {
  it('renders and works with zero products', async () => {
    saveArray.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    await renderEditing(<ArrayAddButton kind="product" items={[]} arrayKey="products" />)
    const button = screen.getByRole('button', { name: 'Add product' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    fireEvent.click(button)

    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))
    expect(saveArray).toHaveBeenCalledWith({
      key: 'products',
      value: [
        {
          id: 'product-1',
          name: 'New product',
          tagline: 'What it promises',
          body: 'What it is and why it matters.',
          tags: [],
          links: [],
        },
      ],
      updatedAt: 'T1',
    })
  })

  it('renders and works with zero track entries', async () => {
    saveArray.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    await renderEditing(<ArrayAddButton kind="entry" items={[]} arrayKey="tracks.0.entries" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }))

    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))
    expect(saveArray).toHaveBeenCalledWith({
      key: 'tracks.0.entries',
      value: [{ id: 'entry-1', org: 'Organization', role: 'Role', period: 'Present', body: '' }],
      updatedAt: 'T1',
    })
  })

  it('renders and works for a product with zero tags (exactly what newProduct ships)', async () => {
    saveArray.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    const zeroTagProducts = [{ ...products[0], tags: [] }, products[1]]
    await renderEditing(
      <ArrayAddButton kind="tag" items={zeroTagProducts} arrayKey="products.0.tags" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))

    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))
    expect(saveArray).toHaveBeenCalledWith({
      key: 'products',
      value: [{ ...zeroTagProducts[0], tags: ['tag-1'] }, products[1]],
      updatedAt: 'T1',
    })
  })
})

describe('ArrayAddButton: disabled at the ARRAY_LIMITS cap', () => {
  it('disables at the products cap (6) with an explanatory title, and does not save if clicked', async () => {
    const sixProducts = Array.from({ length: 6 }, (_, i) => ({ ...products[0], id: `p${i}` }))
    await renderEditing(<ArrayAddButton kind="product" items={sixProducts} arrayKey="products" />)
    const button = screen.getByRole('button', { name: 'Add product' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.title.length).toBeGreaterThan(0)

    fireEvent.click(button)
    await Promise.resolve()
    expect(saveArray).not.toHaveBeenCalled()
  })

  it('disables at the tags cap (8)', async () => {
    const eightTags = Array.from({ length: 8 }, (_, i) => `t${i}`)
    const cappedProducts = [{ ...products[0], tags: eightTags }, products[1]]
    await renderEditing(
      <ArrayAddButton kind="tag" items={cappedProducts} arrayKey="products.0.tags" />,
    )
    expect((screen.getByRole('button', { name: 'Add tag' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('disables at the entries cap (10)', async () => {
    const tenEntries = Array.from({ length: 10 }, (_, i) => ({ ...entries[0], id: `e${i}` }))
    await renderEditing(
      <ArrayAddButton kind="entry" items={tenEntries} arrayKey="tracks.0.entries" />,
    )
    expect(
      (screen.getByRole('button', { name: 'Add entry' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('one below the cap stays enabled and has no title', async () => {
    const fiveProducts = Array.from({ length: 5 }, (_, i) => ({ ...products[0], id: `p${i}` }))
    await renderEditing(<ArrayAddButton kind="product" items={fiveProducts} arrayKey="products" />)
    const button = screen.getByRole('button', { name: 'Add product' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(button.title).toBe('')
  })
})

describe('ArrayAddButton: disabled while a save is in flight', () => {
  it('is disabled for the duration of any in-flight save', async () => {
    let resolveSave: (value: { ok: true; updatedAt: string }) => void = () => {}
    saveArray.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        }),
    )
    await renderEditing(<ArrayAddButton kind="product" items={products} arrayKey="products" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }))
    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))

    expect(
      (screen.getByRole('button', { name: 'Add product' }) as HTMLButtonElement).disabled,
    ).toBe(true)

    resolveSave({ ok: true, updatedAt: 'T2' })
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Add product' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    )
  })
})
