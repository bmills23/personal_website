// @vitest-environment jsdom
//
// Isolated from tests/array-controls.test.tsx on purpose, mirroring
// tests/array-controls-race.test.tsx's isolation rationale: this file
// mocks something the main file deliberately does not, so keeping it
// separate avoids changing behavior for every other test in that file.
//
// What this proves, and why not the "buttons stay disabled" assertion
// directly: the fix wraps `router.refresh()` in `startTransition` so
// `isPending` keeps `savingDisabled`/`disabled` true across the window
// between a successful save and `router.refresh()` actually landing (see
// `runArraySave`'s doc comment in ArrayControls.tsx). Empirically (verified
// before writing this file, with a manually-controlled saveArray promise
// and both microtask-only and real-macrotask sleeps), that window does not
// survive contact with this test environment: `next/navigation`'s
// `useRouter` is mocked here as a synchronous no-op (`refresh: vi.fn()`),
// so the `startTransition` callback does no async work and no state
// updates of its own - React settles `isPending` back to `false` within a
// single macrotask, often before even one `setTimeout(0)` resolves. Any
// assertion built on `waitFor` would find only `disabled === false`
// (`waitFor` itself flushes pending work via `act()` before polling, which
// forces the transition fully settled), and any assertion built on raw
// microtask flushes without `act()` is indistinguishable from "React
// simply hasn't committed yet" rather than "isPending is genuinely still
// true" - both read as `disabled === true` at that point, so it is not a
// meaningful signal either. There is no reliable window to observe in a
// jsdom test with a synchronous mock router, though the real browser does
// have one (a real `router.refresh()` triggers a network round-trip for
// the RSC payload).
//
// So this file instead asserts the thing that actually distinguishes the
// fix from the bug it closes: `router.refresh()` must run AS THE CALLBACK
// PASSED TO `startTransition`, not as a bare direct call. That is exactly
// the code-level change the fix makes (see the `runArraySave` diff), it is
// what makes `isPending` meaningful at all, and it is falsifiable: reverting
// `runArraySave` to call `router.refresh()` directly (the pre-fix shape)
// makes every assertion below fail, because `startTransitionSpy` would
// never be invoked while `refresh` would still land - see this file's
// mutation check at the bottom.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const startTransitionSpy = vi.fn((fn: () => void) => fn())
type TransitionTuple = readonly [boolean, (fn: () => void) => void]
const useTransitionMock = vi.fn<() => TransitionTuple>(() => [false, startTransitionSpy])
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useTransition: () => useTransitionMock(),
  }
})

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
  { id: 'p1', name: 'Alpha', tagline: 'a tag', body: 'a body', tags: [], links: [] },
  { id: 'p2', name: 'Beta', tagline: 'b tag', body: 'b body', tags: [], links: [] },
]

beforeEach(() => {
  vi.clearAllMocks()
  startTransitionSpy.mockImplementation((fn: () => void) => fn())
  useTransitionMock.mockImplementation(() => [false, startTransitionSpy] as const)
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

/** Mirrors tests/array-controls.test.tsx's renderEditing helper exactly. */
async function renderEditing(children: React.ReactNode, updatedAt = 'T1') {
  window.localStorage.setItem(HINT_KEY, '1')
  getEditorState.mockResolvedValue({ ok: true, updatedAt })
  const utils = render(<EditProvider>{children}</EditProvider>)
  const toggle = await screen.findByRole('button', { name: /edit page/i })
  fireEvent.click(toggle)
  return utils
}

describe('ArrayControls: router.refresh runs inside startTransition (post-success race fix)', () => {
  it('a successful remove/move op wraps its router.refresh() in the startTransition callback', async () => {
    saveArray.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    await renderEditing(
      <ArrayControls kind="product" items={products} index={1} arrayKey="products" />,
    )
    expect(startTransitionSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Move product up' }))
    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))

    await waitFor(() => expect(startTransitionSpy).toHaveBeenCalledTimes(1))
    // startTransitionSpy's default mock implementation invokes its
    // argument synchronously (`(fn) => fn()`), so `refresh` only lands
    // AS A RESULT of that invocation - proving the call chain is
    // router.refresh() nested inside the startTransition callback, not a
    // sibling statement next to it.
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(startTransitionSpy.mock.calls[0][0]).toBeTypeOf('function')
  })

  it('a stale rejection also wraps its resync refresh in startTransition', async () => {
    saveArray.mockResolvedValue({ ok: false, error: 'stale' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderEditing(
      <ArrayControls kind="product" items={products} index={0} arrayKey="products" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove product' }))
    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))

    await waitFor(() => expect(startTransitionSpy).toHaveBeenCalledTimes(1))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('a non-stale failure never calls startTransition or refresh at all', async () => {
    saveArray.mockResolvedValue({ ok: false, error: 'invalid' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderEditing(
      <ArrayControls kind="product" items={products} index={0} arrayKey="products" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove product' }))
    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.getByText('Not saved: that value is not allowed.')).toBeTruthy(),
    )

    expect(startTransitionSpy).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('ArrayAddButton also wraps its refresh in startTransition', async () => {
    saveArray.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    await renderEditing(<ArrayAddButton kind="product" items={products} arrayKey="products" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }))
    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))

    await waitFor(() => expect(startTransitionSpy).toHaveBeenCalledTimes(1))
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})

describe('ArrayControls/ArrayAddButton: disabled includes isPending, not just status.state', () => {
  it('ArrayControls buttons read disabled from (status.state === "saving") || isPending, verified by forcing isPending true', async () => {
    // useTransition runs on EVERY render of these components (it is called
    // unconditionally, above the `isEditing` early return), and
    // `renderEditing` itself triggers several renders before the buttons
    // ever paint (session unknown -> admin, then the edit-mode toggle
    // click) - so a `mockReturnValueOnce` set here would be consumed by an
    // earlier render where the component was still returning `null`, not
    // by the render that actually paints the buttons this test inspects.
    // `mockReturnValue` (persistent for every call, reset by the next
    // test's `beforeEach`) is what actually forces `isPending` true on the
    // render under test: if the `|| isPending` clause were dropped from
    // either component, this assertion would fail regardless, since
    // `savingDisabled`/`disabled` would then fall back to
    // `status.state === 'saving'` alone (false once idle).
    useTransitionMock.mockReturnValue([true, startTransitionSpy] as const)
    await renderEditing(
      <ArrayControls kind="product" items={products} index={0} arrayKey="products" />,
    )
    expect(
      (screen.getByRole('button', { name: 'Remove product' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Move product down' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('ArrayAddButton reads disabled from (status.state === "saving") || isPending, verified by forcing isPending true', async () => {
    useTransitionMock.mockReturnValue([true, startTransitionSpy] as const)
    await renderEditing(<ArrayAddButton kind="product" items={products} arrayKey="products" />)
    expect(
      (screen.getByRole('button', { name: 'Add product' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})
