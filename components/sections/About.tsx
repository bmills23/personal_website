import type { Content } from '@/lib/content/schema'
import { MarginNote } from '@/components/shell/MarginNote'
import { Reveal } from '@/components/shell/Reveal'
import { WrittenHeading } from '@/components/shell/WrittenHeading'

export function About({ about }: { about: Content['about'] }) {
  return (
    <section id="about" className="border-t border-card-border py-14">
      <Reveal>
        <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-stamp">
          About
        </p>
        <WrittenHeading as="h2" className="font-display text-3xl text-ink sm:text-4xl">
          {about.heading}
        </WrittenHeading>
        <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="space-y-4 text-[16px] leading-relaxed text-graphite">
            {about.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          {about.marginNote ? (
            <aside className="md:pt-2">
              <MarginNote>{about.marginNote}</MarginNote>
            </aside>
          ) : null}
        </div>
      </Reveal>
    </section>
  )
}
