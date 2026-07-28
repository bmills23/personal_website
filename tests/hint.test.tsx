// @vitest-environment jsdom
//
// Covers the CRITICAL storage-blocking fix in lib/editor/hint.ts: in a
// browser with all cookies/storage blocked (Safari "Block all cookies", a
// privacy extension, some locked-down corporate browsers), the
// `window.localStorage` GETTER itself throws a SecurityError - not just its
// methods. `hasEditorHint` runs inside a root-layout client effect
// (EditProvider.tsx) for EVERY visitor, so before the fix, a blocked
// visitor's first paint threw straight up to Next's default error screen.
//
// `Object.defineProperty` swaps `window.localStorage` for a getter that
// throws, exactly reproducing that SecurityError without needing a real
// storage-blocking browser. jsdom defines `localStorage` as a configurable
// own accessor property on `window`, so this is restorable after each test.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { hasEditorHint, setEditorHint, clearEditorHint } from '@/lib/editor/hint'

const getEditorState = vi.fn()
vi.mock('@/app/actions/content', () => ({
  getEditorState: (...args: unknown[]) => getEditorState(...args),
}))

// EditProvider renders <EditToolbar/> unconditionally in its JSX (it just
// returns null for a non-admin session), so EditToolbar's module - and
// therefore its import of signOutAction, which pulls in next-auth's server
// chain - loads regardless. Mocked here the same way
// tests/edit-provider.test.tsx and tests/array-controls.test.tsx do it, to
// keep this a pure jsdom test.
vi.mock('@/app/actions/auth', () => ({
  signOutAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

// EditProvider imported after the mocks above so it picks them up.
import { EditProvider } from '@/components/editor/EditProvider'

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')

/** Replaces `window.localStorage` with a getter that throws a
 * SecurityError, the same shape browsers report when cookies/storage are
 * blocked entirely (not merely quota-exceeded on a call). */
function blockStorage() {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    },
  })
}

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor)
  }
  vi.clearAllMocks()
})

describe('hint.ts storage-blocked guard', () => {
  it('hasEditorHint returns false (not throw) when the localStorage getter throws', () => {
    blockStorage()
    expect(() => hasEditorHint()).not.toThrow()
    expect(hasEditorHint()).toBe(false)
  })

  it('setEditorHint does not throw when the localStorage getter throws', () => {
    blockStorage()
    expect(() => setEditorHint()).not.toThrow()
  })

  it('clearEditorHint does not throw when the localStorage getter throws', () => {
    blockStorage()
    expect(() => clearEditorHint()).not.toThrow()
  })

  it('EditProvider renders children without crashing and never calls getEditorState when storage is blocked', async () => {
    blockStorage()
    render(
      <EditProvider>
        <div data-testid="page-content">page</div>
      </EditProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('page-content')).toBeTruthy())
    // Flush any pending microtasks; getEditorState must never fire since
    // hasEditorHint() degrades to false rather than throwing.
    await Promise.resolve()
    expect(getEditorState).not.toHaveBeenCalled()
    // No toolbar either: session never advances past 'unknown' -> only
    // reached via a successful getEditorState call.
    expect(screen.queryByRole('button', { name: /edit page/i })).toBeNull()
  })
})
