import Link from 'next/link'

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-4xl px-5 py-24 sm:px-8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-stamp">Error 404</p>
      <h1 className="mt-3 font-display text-4xl text-ink">
        This entry is not in the notebook.
      </h1>
      <p className="mt-4 text-[16px] text-graphite">
        The page you are looking for does not exist, or never did.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center rounded-sm border-2 border-ink px-5 text-[14px] text-ink hover:bg-ink hover:text-paper"
      >
        Back to the first page
      </Link>
    </main>
  )
}
