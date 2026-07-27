import type { Content } from '@/lib/content/schema'
import { Reveal } from '@/components/shell/Reveal'
import { WrittenHeading } from '@/components/shell/WrittenHeading'

export function Tracks({ tracks }: { tracks: Content['tracks'] }) {
  return (
    <section id="work" className="border-t border-card-border py-14">
      <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-stamp">
        Two tracks, at once
      </p>
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
              <p className="text-[11px] uppercase tracking-[0.18em] text-pencil">
                {track.label}
              </p>
              <div className="mt-4 space-y-6">
                {track.entries.map((entry) => (
                  <div key={entry.id}>
                    <h3 className="font-display text-xl text-ink">{entry.org}</h3>
                    <p className="mt-1 text-[13px] text-pencil">
                      {entry.role} &middot; {entry.period}
                    </p>
                    {entry.body ? (
                      <p className="mt-2 text-[15px] leading-relaxed text-graphite">
                        {entry.body}
                      </p>
                    ) : null}
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
