/**
 * A first-time visitor must never trigger a network/auth call. This local
 * hint is the sole gate for whether EditProvider bothers asking the server
 * "am I the admin": present, ask; absent, stay silent. Set by ?edit=1
 * arriving from a signed-in redirect, cleared the moment the server says
 * "not admin" (so a stale hint from a signed-out browser stops re-asking
 * forever).
 */
const HINT_KEY = 'bgm-editor'

export function hasEditorHint(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(HINT_KEY) !== null
}

export function setEditorHint(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(HINT_KEY, '1')
}

export function clearEditorHint(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(HINT_KEY)
}
