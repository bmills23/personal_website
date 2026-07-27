'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-4xl px-5 py-24 sm:px-8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-stamp">Error 500</p>
      <h1 className="mt-3 font-display text-4xl text-ink">
        Something smudged the page.
      </h1>
      <p className="mt-4 text-[16px] text-graphite">
        An unexpected error occurred. Trying again often works.
      </p>
      <button
        onClick={reset}
        className="mt-8 inline-flex min-h-11 items-center rounded-sm border-2 border-ink px-5 text-[14px] text-ink hover:bg-ink hover:text-paper"
      >
        Try again
      </button>
    </main>
  )
}
