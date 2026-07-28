// @vitest-environment jsdom
//
// Isolated from tests/array-controls.test.tsx on purpose. This file proves
// ArrayControls's click-time-token mechanism (see the long comment on
// `runArraySave` in components/editor/ArrayControls.tsx) directly, by
// mocking the editor context instead of rendering through the real
// `EditProvider`.
//
// Why not just click two buttons through the real provider: once buttons
// are disabled while `status.state === 'saving'` (see the "disabled while a
// save is in flight" describe block in array-controls.test.tsx), a real
// click on a second ArrayControls button while another is in flight cannot
// reach its handler at all - confirmed empirically: `fireEvent.click` on a
// `disabled` button never invokes `onClick`, and `EditProvider`'s
// `reportStatus({state:'saving'})` call (made synchronously, before the
// save's `await`) is already reflected in the DOM by the time the
// triggering `fireEvent.click` call returns, since Testing Library flushes
// pending updates via `act()` before returning control. So a literal
// "click op B while op A is in flight" scenario is unreachable via the real
// provider once that (separately required, separately tested) disabling is
// in place - which is by design: disabling closes the SAME-SESSION version
// of this race in the UI. The token fix is the deeper guarantee that holds
// even where disabling can't reach (a slow paint, assistive tech
// bypassing hover/disabled affordances, or simply a future change that
// removes the disabling but leaves the token logic in place) - so this file
// controls `updatedAt`/`status`/`enqueueSave` directly to exercise that
// guarantee without going through the disabled-button gate at all.
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import type { SaveResult } from '@/app/actions/content'

const saveArray = vi.fn()
vi.mock('@/app/actions/content', () => ({
  saveArray: (...args: unknown[]) => saveArray(...args),
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

// A minimal, faithful stand-in for EditProvider's real `updatedAt` +
// `enqueueSave`: one shared queue, and the token each queued callback
// receives is read from `mockUpdatedAt` AT THE MOMENT THAT CALLBACK RUNS
// (exactly like the real `updatedAtRef.current` read in
// EditProvider.tsx's enqueueSave), which only advances once an earlier
// queued save actually resolves `ok: true`. Neither of these react to
// React's render cycle - `useEditor()` below just returns their current
// values fresh on every call, and nothing here schedules a re-render, so
// each ArrayControls instance's `disabled` prop stays exactly what it was
// computed as at ITS OWN last render, under this test's full control.
let mockUpdatedAt: string | null = 'T1'
let queue: Promise<unknown> = Promise.resolve()
function enqueueSave(fn: (token: string) => Promise<SaveResult>): Promise<SaveResult> {
  const run: Promise<SaveResult> = queue.then(async () => {
    const token = mockUpdatedAt
    if (token === null) return { ok: false, error: 'server' }
    try {
      const result = await fn(token)
      if (result.ok) mockUpdatedAt = result.updatedAt
      return result
    } catch {
      return { ok: false, error: 'server' }
    }
  })
  queue = run
  return run
}

const reportStatus = vi.fn()

vi.mock('@/components/editor/EditProvider', () => ({
  useEditor: () => ({
    session: 'admin',
    editing: true,
    updatedAt: mockUpdatedAt,
    status: { state: 'idle' },
    reportStatus,
    enqueueSave,
  }),
  saveErrorMessage: (error: string) =>
    error === 'stale'
      ? 'This page changed elsewhere. Reload before editing.'
      : 'Not saved: server error.',
}))

import { ArrayControls } from '@/components/editor/ArrayControls'

const products = [
  { id: 'p1', name: 'Alpha', tagline: 'a tag', body: 'a body', tags: [], links: [] },
  { id: 'p2', name: 'Beta', tagline: 'b tag', body: 'b body', tags: [], links: [] },
]

describe('ArrayControls: click-time token pinning (Finding 1 fix)', () => {
  it("op B's save carries the token that was current at ITS OWN click, not the fresher token op A's success produces while B is still queued behind it (mutation-tested)", async () => {
    mockUpdatedAt = 'T1'
    queue = Promise.resolve()
    let resolveFirst: (value: SaveResult) => void = () => {}
    let callCount = 0
    saveArray.mockImplementation(() => {
      callCount += 1
      if (callCount === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve
        })
      }
      // The server's real optimistic-concurrency check would reject this
      // exact call as stale once the fix is correctly wired (client token
      // T1 no longer matches the row's real token T2) - reproduced here
      // directly rather than exercising the server.
      return Promise.resolve({ ok: false, error: 'stale' })
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    // Two independent ArrayControls renders (not re-rendered again after
    // this), each reading `useEditor()` fresh - standing in for "the state
    // of the world at each one's own click", not "whatever the world looks
    // like by the time its queued save actually executes".
    render(<ArrayControls kind="product" items={products} index={0} arrayKey="products" />)
    render(<ArrayControls kind="product" items={products} index={1} arrayKey="products" />)

    // Op A: remove product 0. Captures updatedAt = 'T1' at this render's
    // click. Stays in flight (saveArray's first call never resolves yet).
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove product' })[0])
    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(1))
    expect(saveArray).toHaveBeenNthCalledWith(1, {
      key: 'products',
      value: [products[1]],
      updatedAt: 'T1',
    })
    // Confirms A has not resolved yet: the shared token has not advanced.
    expect(mockUpdatedAt).toBe('T1')

    // Op B: remove product 1. This render was never told A happened (no
    // rerender), so it reads `updatedAt` fresh via `useEditor()` right now
    // - still 'T1', since A's success (the only thing that would advance
    // it) has not happened yet. This is "op B clicked while op A is in
    // flight", exactly as the finding describes, without going through a
    // disabled button.
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove product' })[1])

    // B is queued behind A (enqueueSave's single shared queue): its call
    // must not have gone out yet.
    await Promise.resolve()
    expect(saveArray).toHaveBeenCalledTimes(1)

    // A resolves now, advancing the shared token to T2.
    resolveFirst({ ok: true, updatedAt: 'T2' })
    await waitFor(() => expect(mockUpdatedAt).toBe('T2'))

    // B's turn runs now. Its call must carry T1 (what `updatedAt` was AT
    // ITS OWN CLICK, captured synchronously in ArrayControls's handler
    // closure), never T2 (the execution-time value `mockUpdatedAt` holds
    // by the time B's queued callback actually runs). Carrying T2 here
    // would be exactly the bug: B's payload (`[products[0]]`) was computed
    // from the same stale `products` array A used, so accepting it under a
    // token that merely proves SOME save landed would silently undo A's
    // change with no error at all.
    await waitFor(() => expect(saveArray).toHaveBeenCalledTimes(2))
    expect(saveArray).toHaveBeenNthCalledWith(2, {
      key: 'products',
      value: [products[0]],
      updatedAt: 'T1',
    })
  })
})
