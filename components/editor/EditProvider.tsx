'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
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

    getEditorState().then((result) => {
      if (!active) return
      if (result.ok) {
        setSession('admin')
        setUpdatedAtState(result.updatedAt)
      } else {
        setSession('none')
        clearEditorHint()
      }
    })

    return () => {
      active = false
    }
  }, [])

  const toggleEditing = useCallback(() => setEditing((prev) => !prev), [])
  const setUpdatedAt = useCallback((token: string) => setUpdatedAtState(token), [])
  const reportStatus = useCallback((next: SaveStatus) => setStatus(next), [])

  const value: EditorContextValue = {
    session,
    editing,
    updatedAt,
    toggleEditing,
    setUpdatedAt,
    status,
    reportStatus,
  }

  return (
    <EditorContext.Provider value={value}>
      {children}
      <EditToolbar />
    </EditorContext.Provider>
  )
}
