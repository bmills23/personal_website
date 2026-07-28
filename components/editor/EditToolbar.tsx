'use client'

import { useRouter } from 'next/navigation'
import { revertLastSave } from '@/app/actions/content'
import { signOutAction } from '@/app/actions/auth'
import { clearEditorHint } from '@/lib/editor/hint'
import { saveErrorMessage, useEditor } from './EditProvider'

const buttonClass =
  'min-h-11 rounded-sm border border-card-border px-3 text-[13px] text-ink hover:text-stamp'

export function EditToolbar() {
  const { session, editing, toggleEditing, updatedAt, setUpdatedAt, status, reportStatus } =
    useEditor()
  const router = useRouter()

  // Server render and the initial client render both land here for a
  // visitor: no DOM at all, so hydration matches and there is nothing to
  // clean up client-side either.
  if (session !== 'admin') return null

  async function handleRevert() {
    if (!updatedAt) return
    if (!window.confirm('Revert the most recent save?')) return
    try {
      const result = await revertLastSave({ updatedAt })
      if (result.ok) {
        setUpdatedAt(result.updatedAt)
        router.refresh()
      } else {
        reportStatus({ state: 'error', message: saveErrorMessage(result.error) })
      }
    } catch {
      // A rejected action (network/DB hiccup) reads the same as the
      // action's own 'server' error, rather than an unhandled rejection.
      reportStatus({ state: 'error', message: saveErrorMessage('server') })
    }
  }

  async function handleSignOut() {
    try {
      await signOutAction()
    } catch {
      // Sign-out itself failed: surface it and stay put. Clearing the hint
      // or navigating here would drop the admin's hint on a still-valid
      // session, purely because the sign-out call had a transient failure.
      reportStatus({ state: 'error', message: saveErrorMessage('server') })
      return
    }
    clearEditorHint()
    window.location.assign('/')
  }

  const statusText =
    status.state === 'saving'
      ? 'Saving'
      : status.state === 'saved'
        ? 'Saved'
        : status.state === 'error'
          ? status.message
          : ''

  return (
    <div className="fixed bottom-4 right-4 z-30 flex max-w-[340px] flex-wrap items-center gap-2 rounded-sm border border-card-border bg-paper px-3 py-2 shadow-sm">
      <button
        type="button"
        aria-pressed={editing}
        onClick={toggleEditing}
        className={buttonClass}
      >
        Edit page
      </button>
      <button type="button" onClick={handleRevert} className={buttonClass}>
        Revert last save
      </button>
      <button type="button" onClick={handleSignOut} className={buttonClass}>
        Sign out
      </button>
      <p aria-live="polite" className="basis-full text-[12px] leading-snug text-pencil">
        {statusText}
      </p>
    </div>
  )
}
