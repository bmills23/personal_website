/**
 * The single authorization predicate for the whole editor. Both the OAuth
 * signIn callback and every write action funnel through this. It fails
 * closed: a missing ADMIN_GITHUB_LOGIN env means nobody is admin, never
 * everybody.
 */
export function isAdminLogin(login: unknown, adminLogin: string | undefined): boolean {
  if (typeof login !== 'string' || login.length === 0) return false
  if (typeof adminLogin !== 'string' || adminLogin.length === 0) return false
  // GitHub logins are case-insensitive.
  return login.toLowerCase() === adminLogin.toLowerCase()
}
