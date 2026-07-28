import { TapedCard } from '@/components/shell/TapedCard'

// Required so `next build` (cacheComponents: true) can prerender a static
// shell for this route: page.tsx reads the session cookie via auth() and
// awaits searchParams, both per-request data with no Suspense boundary of
// their own. A loading.tsx alongside page.tsx makes Next.js wrap the whole
// segment in <Suspense> automatically, which satisfies that requirement
// without changing page.tsx itself. This fallback only shows if that
// request-time work is slow enough to be visible, which a JWT session
// cookie read normally is not; it mirrors LoginCard's own shell so there
// is no layout shift if it does.
export default function Loading() {
  return (
    <main id="main" className="mx-auto flex min-h-[60vh] max-w-md items-center px-5 py-16 sm:px-8">
      <TapedCard className="w-full">
        <div className="h-7 w-40 rounded-sm bg-card-border/40" aria-hidden="true" />
      </TapedCard>
    </main>
  )
}
