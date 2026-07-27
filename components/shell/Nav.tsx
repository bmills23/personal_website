import Link from 'next/link'

const LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Work', href: '#work' },
  { label: 'Products', href: '#products' },
  { label: 'Contact', href: '#contact' },
]

export function Nav() {
  return (
    <nav className="sticky top-0 z-20 border-b border-card-border bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-8">
        <Link href="/" className="font-hand text-xl text-ink">
          Bryan Mills
        </Link>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-pencil">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex min-h-11 items-center hover:text-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
