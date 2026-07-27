export function Footer({
  note,
  links,
}: {
  note: string
  links: { label: string; url: string }[]
}) {
  return (
    <footer className="mt-20 border-t border-card-border">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-pencil sm:px-8">
        <p>{note}</p>
        <ul className="flex gap-4">
          {links.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                className="inline-flex min-h-11 items-center hover:text-ink"
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
