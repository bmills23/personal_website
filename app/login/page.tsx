import type { Metadata } from 'next'
import { auth, authConfigured, isAdminLogin, signIn, signOut } from '@/lib/auth'
import { LoginCard } from '@/components/editor/LoginCard'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  if (!authConfigured()) {
    return <LoginCard state="unconfigured" />
  }
  const session = await auth()
  if (session?.user && isAdminLogin(session.user.login, process.env.ADMIN_GITHUB_LOGIN)) {
    return (
      <LoginCard state="signedIn">
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/' })
          }}
        >
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-sm border border-card-border px-4 text-[14px] text-ink hover:text-stamp"
          >
            Sign out
          </button>
        </form>
      </LoginCard>
    )
  }
  // Auth.js redirects failed sign-ins here with ?error=AccessDenied. Any
  // error value gets the same flat refusal.
  if (typeof params.error === 'string' && params.error.length > 0) {
    return <LoginCard state="denied" />
  }
  return (
    <LoginCard state="signedOut">
      <form
        action={async () => {
          'use server'
          await signIn('github', { redirectTo: '/?edit=1' })
        }}
      >
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-sm border border-card-border bg-ink px-4 text-[14px] text-paper hover:bg-graphite"
        >
          Sign in with GitHub
        </button>
      </form>
    </LoginCard>
  )
}
