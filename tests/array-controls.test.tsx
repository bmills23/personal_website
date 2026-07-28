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
import { ArrayControls } from '@/components/editor/ArrayControls'

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

  it('add only renders on the last item and appends a template product', async () => {
    saveArray.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    await renderEditing(
      <>
        <ArrayControls kind="product" items={products} index={0} arrayKey="products" />
        <ArrayControls kind="product" items={products} index={1} arrayKey="products" />
      </>,
    )
    expect(screen.getAllByRole('button', { name: 'Add product' })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Add product' }))

    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))
    const call = saveArray.mock.calls[0][0]
    expect(call.key).toBe('products')
    expect(call.updatedAt).toBe('T1')
    expect(call.value).toHaveLength(3)
    expect(call.value[2]).toEqual({
      id: 'product-1',
      name: 'New product',
      tagline: 'What it promises',
      body: 'What it is and why it matters.',
      tags: [],
      links: [],
    })
  })

  it('a failed save reports the mapped error and does not refresh', async () => {
    saveArray.mockResolvedValue({ ok: false, error: 'stale' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderEditing(
      <ArrayControls kind="product" items={products} index={0} arrayKey="products" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove product' }))

    await waitFor(() =>
      expect(screen.getByText('This page changed elsewhere. Reload before editing.')).toBeTruthy(),
    )
    expect(refresh).not.toHaveBeenCalled()
  })
})

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

  it('add appends a template entry', async () => {
    saveArray.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    await renderEditing(
      <ArrayControls kind="entry" items={entries} index={1} arrayKey="tracks.0.entries" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }))

    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))
    const call = saveArray.mock.calls[0][0]
    expect(call.key).toBe('tracks.0.entries')
    expect(call.value).toHaveLength(3)
    expect(call.value[2]).toEqual({
      id: 'entry-1',
      org: 'Organization',
      role: 'Role',
      period: 'Present',
      body: '',
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

  it('renders only remove (no move buttons), plus a trailing add on the last tag', async () => {
    await renderEditing(
      <>
        <ArrayControls kind="tag" items={products} index={0} arrayKey="products.0.tags" />
        <ArrayControls kind="tag" items={products} index={1} arrayKey="products.0.tags" />
      </>,
    )
    expect(screen.queryByRole('button', { name: /^Move tag (up|down)$/i })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Remove tag' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Add tag' })).toHaveLength(1)
  })

  it('add appends a generated tag string and saves the whole products array', async () => {
    saveArray.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    await renderEditing(
      <ArrayControls kind="tag" items={products} index={1} arrayKey="products.0.tags" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))

    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))
    expect(saveArray).toHaveBeenCalledWith({
      key: 'products',
      value: [{ ...products[0], tags: ['x', 'y', 'tag-1'] }, products[1]],
      updatedAt: 'T1',
    })
  })
})
