import type { Content } from '@/lib/content/schema'
import { Reveal } from '@/components/shell/Reveal'
import { WrittenHeading } from '@/components/shell/WrittenHeading'
import { Editable, EditableInline } from '@/components/editor/Editable'
import { ArrayControls } from '@/components/editor/ArrayControls'

export function Tracks({
  tracks,
  kicker,
}: {
  tracks: Content['tracks']
  kicker: string
}) {
  return (
    <section id="work" className="border-t border-card-border py-14">
      <Editable
        path="sections.work.kicker"
        text={kicker}
        as="p"
        className="mb-3 text-[11px] uppercase tracking-[0.18em] text-stamp"
      />
      <WrittenHeading as="h2" className="font-display text-3xl text-ink sm:text-4xl">
        Work
      </WrittenHeading>
      {/* No min-w-0 shrink guard here: it would land on this div, one DOM
          level below the actual grid item (Reveal's motion.div), where CSS
          grid's automatic-minimum-size resolution does not see it, so it
          would be inert. Verified experimentally in Products.tsx's twin
          layout: an unbreakable long string overflows identically whether
          min-w-0 is placed here, moved onto the real grid item, or omitted
          entirely. The layout's actual protection against long unbroken
          strings is `body { overflow-wrap: anywhere }` in
          app/globals.css. */}
      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-0">
        {tracks.map((track, i) => (
          <Reveal key={track.id} delay={i * 0.08}>
            <div
              className={
                i === 0
                  ? 'md:border-r md:border-card-border md:pr-8'
                  : 'md:pl-8'
              }
            >
              <Editable
                path={`tracks.${i}.label`}
                text={track.label}
                as="p"
                className="text-[11px] uppercase tracking-[0.18em] text-pencil"
              />
              <div className="mt-4 space-y-6">
                {track.entries.map((entry, ei) => (
                  <div key={entry.id}>
                    <ArrayControls
                      kind="entry"
                      items={track.entries}
                      index={ei}
                      arrayKey={`tracks.${i}.entries`}
                    />
                    <Editable
                      path={`tracks.${i}.entries.${ei}.org`}
                      text={entry.org}
                      as="h3"
                      className="font-display text-xl text-ink"
                    />
                    <p className="mt-1 text-[13px] text-pencil">
                      <EditableInline path={`tracks.${i}.entries.${ei}.role`} text={entry.role} /> &middot; <EditableInline path={`tracks.${i}.entries.${ei}.period`} text={entry.period} />
                    </p>
                    <Editable
                      path={`tracks.${i}.entries.${ei}.body`}
                      text={entry.body}
                      as="p"
                      className="mt-2 text-[15px] leading-relaxed text-graphite"
                      placeholder="entry details"
                    />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
