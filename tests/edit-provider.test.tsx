// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const getEditorState = vi.fn()
const revertLastSave = vi.fn()
vi.mock('@/app/actions/content', () => ({
  getEditorState: (...args: unknown[]) => getEditorState(...args),
  revertLastSave: (...args: unknown[]) => revertLastSave(...args),
}))

const signOutAction = vi.fn()
vi.mock('@/app/actions/auth', () => ({
  signOutAction: (...args: unknown[]) => signOutAction(...args),
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

import { EditProvider, useEditor, saveErrorMessage } from '@/components/editor/EditProvider'

const HINT_KEY = 'bgm-editor'

function EditingProbe() {
  const { editing } = useEditor()
  return <span data-testid="editing">{String(editing)}</span>
}

function SessionProbe() {
  const { session } = useEditor()
  return <span data-testid="session">{session}</span>
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('EditProvider hint gating', () => {
  it('without the hint, never calls getEditorState and renders no toolbar', async () => {
    render(
      <EditProvider>
        <div>page</div>
      </EditProvider>,
    )
    // Flush any pending microtasks; there should be none from a network call.
    await Promise.resolve()
    expect(getEditorState).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /edit page/i })).toBeNull()
  })

  it('with the hint set and getEditorState resolving ok, the toolbar appears with admin session', async () => {
    window.localStorage.setItem(HINT_KEY, '1')
    getEditorState.mockResolvedValue({ ok: true, updatedAt: 'T1' })
    render(
      <EditProvider>
        <div>page</div>
      </EditProvider>,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: /edit page/i })).toBeTruthy())
    expect(screen.getByRole('button', { name: /revert last save/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy()
  })

  it('with the hint set and getEditorState resolving not-ok, the toolbar stays absent and the hint is cleared', async () => {
    window.localStorage.setItem(HINT_KEY, '1')
    getEditorState.mockResolvedValue({ ok: false })
    render(
      <EditProvider>
        <div>page</div>
      </EditProvider>,
    )
    await waitFor(() => expect(getEditorState).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /edit page/i })).toBeNull()
    await waitFor(() => expect(window.localStorage.getItem(HINT_KEY)).toBeNull())
  })

  it('?edit=1 in the URL sets the hint and is stripped from the address bar', async () => {
    window.history.replaceState(null, '', '/?edit=1')
    getEditorState.mockResolvedValue({ ok: true, updatedAt: 'T1' })
    render(
      <EditProvider>
        <div>page</div>
      </EditProvider>,
    )
    await waitFor(() => expect(window.location.search).toBe(''))
    expect(window.localStorage.getItem(HINT_KEY)).not.toBeNull()
    expect(getEditorState).toHaveBeenCalled()
  })

  it('when getEditorState rejects (transient failure), session settles to none but the hint is preserved', async () => {
    window.localStorage.setItem(HINT_KEY, '1')
    getEditorState.mockRejectedValue(new Error('network down'))
    render(
      <EditProvider>
        <SessionProbe />
      </EditProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('session').textContent).toBe('none'))
    // A transient failure is not a definitive "not admin" answer, so unlike
    // the { ok: false } case above, the hint must survive it.
    expect(window.localStorage.getItem(HINT_KEY)).toBe('1')
    expect(screen.queryByRole('button', { name: /edit page/i })).toBeNull()
  })
})

describe('edit toggle', () => {
  it('flips aria-pressed and useEditor().editing together', async () => {
    window.localStorage.setItem(HINT_KEY, '1')
    getEditorState.mockResolvedValue({ ok: true, updatedAt: 'T1' })
    render(
      <EditProvider>
        <EditingProbe />
      </EditProvider>,
    )
    const button = await screen.findByRole('button', { name: /edit page/i })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('editing').textContent).toBe('false')

    fireEvent.click(button)

    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('editing').textContent).toBe('true')
  })
})

describe('revert last save', () => {
  it('confirm true calls revertLastSave with the current token and refreshes on success', async () => {
    window.localStorage.setItem(HINT_KEY, '1')
    getEditorState.mockResolvedValue({ ok: true, updatedAt: 'T1' })
    revertLastSave.mockResolvedValue({ ok: true, updatedAt: 'T2' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <EditProvider>
        <div>page</div>
      </EditProvider>,
    )
    const button = await screen.findByRole('button', { name: /revert last save/i })
    fireEvent.click(button)

    await waitFor(() => expect(revertLastSave).toHaveBeenCalledWith({ updatedAt: 'T1' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('confirm false does not call revertLastSave', async () => {
    window.localStorage.setItem(HINT_KEY, '1')
    getEditorState.mockResolvedValue({ ok: true, updatedAt: 'T1' })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <EditProvider>
        <div>page</div>
      </EditProvider>,
    )
    const button = await screen.findByRole('button', { name: /revert last save/i })
    fireEvent.click(button)

    expect(revertLastSave).not.toHaveBeenCalled()
  })

  it('when revertLastSave rejects, the status region surfaces the server error message', async () => {
    window.localStorage.setItem(HINT_KEY, '1')
    getEditorState.mockResolvedValue({ ok: true, updatedAt: 'T1' })
    revertLastSave.mockRejectedValue(new Error('db down'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <EditProvider>
        <div>page</div>
      </EditProvider>,
    )
    const button = await screen.findByRole('button', { name: /revert last save/i })
    fireEvent.click(button)

    await waitFor(() => expect(screen.getByText('Not saved: server error.')).toBeTruthy())
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('sign out', () => {
  it('when signOutAction rejects, the status region surfaces the server error and the page does not navigate', async () => {
    window.localStorage.setItem(HINT_KEY, '1')
    getEditorState.mockResolvedValue({ ok: true, updatedAt: 'T1' })
    signOutAction.mockRejectedValue(new Error('auth down'))

    // window.location's own properties (assign, reload, ...) are spec'd
    // unforgeable, so vi.spyOn cannot patch location.assign directly (it
    // throws "Cannot redefine property: assign"). window.location itself,
    // the reference on window, IS configurable, so replace the whole object
    // for this test and restore it afterward.
    const originalLocation = window.location
    const assignSpy = vi.fn()
    // @ts-expect-error -- deleting to replace with a spy-augmented stand-in
    delete window.location
    // @ts-expect-error -- same
    window.location = { ...originalLocation, assign: assignSpy }

    try {
      render(
        <EditProvider>
          <div>page</div>
        </EditProvider>,
      )
      const button = await screen.findByRole('button', { name: /sign out/i })
      fireEvent.click(button)

      await waitFor(() => expect(screen.getByText('Not saved: server error.')).toBeTruthy())
      expect(assignSpy).not.toHaveBeenCalled()
      // Sign-out itself failed, so the hint must not be cleared either.
      expect(window.localStorage.getItem(HINT_KEY)).not.toBeNull()
    } finally {
      // @ts-expect-error -- restore the real Location object
      delete window.location
      // @ts-expect-error -- same
      window.location = originalLocation
    }
  })
})

describe('saveErrorMessage', () => {
  it('returns the exact five mapped strings', () => {
    expect(saveErrorMessage('unauthorized')).toBe('Not signed in. Reload the page.')
    expect(saveErrorMessage('stale')).toBe('This page changed elsewhere. Reload before editing.')
    expect(saveErrorMessage('invalid')).toBe('Not saved: that value is not allowed.')
    expect(saveErrorMessage('nothing-to-revert')).toBe('Nothing to revert.')
    expect(saveErrorMessage('server')).toBe('Not saved: server error.')
  })
})
