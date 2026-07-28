import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import { isAdminLogin } from './admin'

export { isAdminLogin }

/**
 * True only when every env var the editor's auth needs is present. Used to
 * degrade gracefully in production before the prod OAuth app exists: the
 * public site never touches auth, /login explains, and saves are rejected.
 */
export function authConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GITHUB_ID &&
      process.env.AUTH_GITHUB_SECRET &&
      process.env.AUTH_SECRET &&
      process.env.ADMIN_GITHUB_LOGIN,
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    signIn({ profile }) {
      const login = (profile as { login?: unknown } | undefined)?.login
      return isAdminLogin(login, process.env.ADMIN_GITHUB_LOGIN)
    },
    jwt({ token, profile }) {
      const login = (profile as { login?: unknown } | undefined)?.login
      if (typeof login === 'string') token.login = login
      return token
    },
    session({ session, token }) {
      if (session.user && typeof token.login === 'string') {
        session.user.login = token.login
      }
      return session
    },
  },
})

/**
 * The check every write action runs first. Note this re-derives admin-ness
 * from the session token rather than trusting that signIn gated it: a
 * forged or replayed session must still carry the admin login to pass.
 */
export async function requireAdminSession(): Promise<{ ok: true; login: string } | { ok: false }> {
  if (!authConfigured()) return { ok: false }
  try {
    const session = await auth()
    const login = session?.user?.login
    if (!isAdminLogin(login, process.env.ADMIN_GITHUB_LOGIN)) return { ok: false }
    return { ok: true, login: login as string }
  } catch {
    // Auth misconfiguration must read as "not signed in", never as a crash
    // in a write path.
    return { ok: false }
  }
}
