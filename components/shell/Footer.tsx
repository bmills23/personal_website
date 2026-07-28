import { Editable } from '@/components/editor/Editable'
import { EditableLink } from '@/components/editor/EditableLink'
import { contentKeys } from '@/lib/editor/listKeys'

export function Footer({
  note,
  links,
}: {
  note: string
  links: { label: string; url: string }[]
}) {
  // Content-based, not index-based: see lib/editor/listKeys.ts for why an
  // index key here would let a removed/reordered link's stale editable
  // state bleed into whatever link shifted into its old slot.
  const linkKeys = contentKeys(links, (link) => JSON.stringify([link.label, link.url]))
  return (
    <footer className="mt-20 border-t border-card-border">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-pencil sm:px-8">
        <Editable path="footer.note" text={note} as="p" />
        <ul className="flex gap-4">
          {links.map((link, i) => (
            <li key={linkKeys[i]}>
              <EditableLink
                labelPath={`footer.links.${i}.label`}
                urlPath={`footer.links.${i}.url`}
                label={link.label}
                url={link.url}
                className="inline-flex min-h-11 items-center hover:text-ink"
                classNameFirst
              />
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
