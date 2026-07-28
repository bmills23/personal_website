import { encode } from 'next-auth/jwt'

/**
 * Forges a valid Auth.js session cookie the way Auth.js itself would mint
 * it (same JWE encoding, same HKDF salt = cookie name). This tests OUR
 * authorization checks: the actions must accept only a token whose login
 * is the admin. It deliberately does not exercise GitHub's OAuth screens.
 */
export const SESSION_COOKIE = 'authjs.session-token'

export async function forgeSessionCookie(login: string): Promise<{
  name: string
  value: string
  domain: string
  path: string
  httpOnly: boolean
  sameSite: 'Lax'
}> {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET missing from the environment; run via node --env-file or export it')
  const value = await encode({
    token: { login, name: 'E2E', sub: 'e2e-user' },
    secret,
    salt: SESSION_COOKIE,
  })
  return { name: SESSION_COOKIE, value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }
}
