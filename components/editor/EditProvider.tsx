'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getEditorState, type SaveResult } from '@/app/actions/content'
import { clearEditorHint, hasEditorHint, setEditorHint } from '@/lib/editor/hint'
import { EditToolbar } from './EditToolbar'

export type SaveStatus =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved' }
  | { state: 'error'; message: string }

type Session = 'unknown' | 'none' | 'admin'

type EditorContextValue = {
  session: Session
  editing: boolean
  updatedAt: string | null
  toggleEditing: () => void
  setUpdatedAt: (token: string) => void
  status: SaveStatus
  reportStatus: (status: SaveStatus) => void
  /**
   * Every write (a field commit, a URL commit, a revert) must go through
   * this instead of calling a server action directly with a token captured
   * from the `updatedAt` state value. Two fields committing close together
   * both read that state at render time, so whichever fires second carries
   * the FIRST field's now-stale token, gets 'stale' back, and restores its
   * own (unrelated) edit as if it had failed - an edit-loss race, not a
   * hypothetical: field A blurs (save in flight, token T1), field B blurs
   * before A resolves, B's call captured T1 too and loses.
   *
   * `enqueueSave` fixes this by chaining every call onto one promise queue
   * (so at most one write is ever in flight) and reading the token from a
   * ref at the moment each queued call actually EXECUTES, not at the moment
   * it was enqueued. A's success updates the ref synchronously before B's
   * turn runs, so B's call sees T2. The returned promise always resolves
   * (never rejects, even if the underlying action throws), so one
   * caller's failure can never wedge every save queued behind it.
   */
  enqueueSave: (fn: (token: string) => Promise<SaveResult>) => Promise<SaveResult>
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext)
  if (!value) throw new Error('useEditor must be used within EditProvider')
  return value
}

/** Shared by the toolbar and (Task 5) Editable so a save failure reads the same way everywhere. */
export function saveErrorMessage(error: Extract<SaveResult, { ok: false }>['error']): string {
  switch (error) {
    case 'unauthorized':
      return 'Not signed in. Reload the page.'
    case 'stale':
      return 'This page changed elsewhere. Reload before editing.'
    case 'invalid':
      return 'Not saved: that value is not allowed.'
    case 'nothing-to-revert':
      return 'Nothing to revert.'
    case 'server':
      return 'Not saved: server error.'
  }
}

export function EditProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>('unknown')
  const [editing, setEditing] = useState(false)
  const [updatedAt, setUpdatedAtState] = useState<string | null>(null)
  const [status, setStatus] = useState<SaveStatus>({ state: 'idle' })

  // The single source of truth `enqueueSave` reads at execution time. Kept
  // in a ref (not just the `updatedAt` state above) because state only
  // updates on the next render, while a queued save needs the freshest
  // token the instant its turn comes up, which can be mid-render-cycle
  // relative to whichever commit resolved just before it.
  const updatedAtRef = useRef<string | null>(null)
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())

  const applyUpdatedAt = useCallback((token: string) => {
    updatedAtRef.current = token
    setUpdatedAtState(token)
  }, [])

  useEffect(() => {
    let active = true

    const params = new URLSearchParams(window.location.search)
    if (params.get('edit') === '1') {
      setEditorHint()
      params.delete('edit')
      const query = params.toString()
      const nextUrl =
        window.location.pathname + (query ? `?${query}` : '') + window.location.hash
      window.history.replaceState(null, '', nextUrl)
    }

    // No hint (first-time visitor, or one the server already rejected): stay
    // silent, never hit the network. This is the whole point of the hint.
    if (!hasEditorHint()) return

    getEditorState()
      .then((result) => {
        if (!active) return
        if (result.ok) {
          setSession('admin')
          applyUpdatedAt(result.updatedAt)
        } else {
          setSession('none')
          clearEditorHint()
        }
      })
      .catch(() => {
        if (!active) return
        // A transient failure (network/DB hiccup) is not a definitive "not
        // admin" answer the way { ok: false } is, so the hint survives and
        // the next mount tries again, unlike the branch above.
        setSession('none')
      })

    return () => {
      active = false
    }
  }, [applyUpdatedAt])

  const toggleEditing = useCallback(() => setEditing((prev) => !prev), [])
  const setUpdatedAt = useCallback((token: string) => applyUpdatedAt(token), [applyUpdatedAt])
  const reportStatus = useCallback((next: SaveStatus) => setStatus(next), [])

  const enqueueSave = useCallback(
    (fn: (token: string) => Promise<SaveResult>): Promise<SaveResult> => {
      const run: Promise<SaveResult> = queueRef.current.then(async () => {
        const token = updatedAtRef.current
        // No token means nothing to save against (never loaded, or a prior
        // load failed): refuse the same way a rejected/failed save reads,
        // rather than calling the action with a token typed as string.
        if (token === null) {
          return { ok: false, error: 'server' }
        }
        try {
          const result = await fn(token)
          if (result.ok) applyUpdatedAt(result.updatedAt)
          return result
        } catch {
          // A thrown/rejected action reads as the action's own 'server'
          // error. Caught here (not just by each caller) so a network
          // hiccup on one queued save can never reject `run` and wedge
          // every save chained behind it.
          return { ok: false, error: 'server' }
        }
      })
      // `run` above always resolves, never rejects, so chaining the next
      // queued save directly onto it is safe regardless of this save's
      // outcome.
      queueRef.current = run
      return run
    },
    [applyUpdatedAt],
  )

  const value: EditorContextValue = {
    session,
    editing,
    updatedAt,
    toggleEditing,
    setUpdatedAt,
    status,
    reportStatus,
    enqueueSave,
  }

  return (
    <EditorContext.Provider value={value}>
      {children}
      <EditToolbar />
    </EditorContext.Provider>
  )
}
