import { TapedCard } from '@/components/shell/TapedCard'

const COPY = {
  unconfigured: {
    heading: 'Editor not configured',
    body: 'The editing environment variables are not set here, so signing in is disabled. The site itself is unaffected.',
  },
  denied: {
    heading: 'Not authorized.',
    body: '',
  },
  signedIn: {
    heading: 'Signed in',
    body: 'Head back to the page and use the pencil toolbar in the corner to edit in place.',
  },
  signedOut: {
    heading: 'Owner sign-in',
    body: 'This unlocks in-place editing for the site owner. There is nothing here for anyone else.',
  },
} as const

export function LoginCard({
  state,
  children,
}: {
  state: keyof typeof COPY
  children?: React.ReactNode
}) {
  const copy = COPY[state]
  return (
    <main id="main" className="mx-auto flex min-h-[60vh] max-w-md items-center px-5 py-16 sm:px-8">
      <TapedCard className="w-full">
        <h1 className="font-display text-2xl text-ink">{copy.heading}</h1>
        {copy.body ? (
          <p className="mt-3 text-[15px] leading-relaxed text-graphite">{copy.body}</p>
        ) : null}
        {state === 'signedIn' ? (
          <p className="mt-4">
            <a href="/?edit=1" className="inline-flex min-h-11 items-center text-ink underline hover:text-stamp">
              Back to the page
            </a>
          </p>
        ) : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </TapedCard>
    </main>
  )
}
