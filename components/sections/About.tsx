import type { Content } from '@/lib/content/schema'
import { Reveal } from '@/components/shell/Reveal'
import { Editable } from '@/components/editor/Editable'
import { HeadingEditable } from '@/components/editor/HeadingEditable'
import { EditableMarginNote } from '@/components/editor/EditableMarginNote'

export function About({ about }: { about: Content['about'] }) {
  return (
    <section id="about" className="border-t border-card-border py-14">
      <Reveal>
        <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-stamp">
          About
        </p>
        <HeadingEditable
          path="about.heading"
          text={about.heading}
          className="font-display text-3xl text-ink sm:text-4xl"
        />
        <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="space-y-4 text-[16px] leading-relaxed text-graphite">
            {about.paragraphs.map((paragraph, i) => (
              <Editable key={i} path={`about.paragraphs.${i}`} text={paragraph} as="p" />
            ))}
          </div>
          <EditableMarginNote path="about.marginNote" text={about.marginNote} wrapper="aside" />
        </div>
      </Reveal>
    </section>
  )
}
