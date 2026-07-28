/**
 * A first-time visitor must never trigger a network/auth call. This local
 * hint is the sole gate for whether EditProvider bothers asking the server
 * "am I the admin": present, ask; absent, stay silent. Set by ?edit=1
 * arriving from a signed-in redirect, cleared the moment the server says
 * "not admin" (so a stale hint from a signed-out browser stops re-asking
 * forever).
 */
const HINT_KEY = 'bgm-editor'

// In a browser with all cookies/storage blocked (e.g. Safari's "Block all
// cookies", or a privacy extension), the `window.localStorage` GETTER
// itself throws a SecurityError - not just its methods. `hasEditorHint`
// runs inside a root-layout client effect for every single visitor
// (EditProvider.tsx), so an uncaught throw there tears down the whole page
// to Next's default error screen for anyone with storage blocked. Every
// function below wraps its storage access in try/catch so a blocked
// visitor degrades to "no hint" / "hint write silently did nothing"
// instead of a crash.

export function hasEditorHint(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(HINT_KEY) !== null
  } catch {
    return false
  }
}

export function setEditorHint(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HINT_KEY, '1')
  } catch {
    // Best-effort only; see the SecurityError note above.
  }
}

export function clearEditorHint(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(HINT_KEY)
  } catch {
    // Best-effort only; see the SecurityError note above.
  }
}
