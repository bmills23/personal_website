import type { Content } from '@/lib/content/schema'
import { Stamp } from '@/components/shell/Stamp'
import { MarginNote } from '@/components/shell/MarginNote'
import { Highlight } from '@/components/shell/Highlight'
import { splitHighlights } from '@/lib/highlight'
import { Editable, EditableInline } from '@/components/editor/Editable'

/**
 * The hero's h1 is the page's Largest Contentful Paint element and the
 * owner's explicit call was scroll-triggered motion only, so it renders as a
 * plain heading: no WrittenHeading, no Reveal. `Editable`'s view-mode output
 * for `as="h1"` is exactly `<h1 className>{text}</h1>`, byte-identical to
 * the plain h1 this section always rendered, so making it editable does not
 * touch the LCP rule: a visitor (or an admin not editing) still gets the
 * same plain, unanimated heading.
 */
export function Hero({ hero }: { hero: Content['hero'] }) {
  return (
    <section className="relative pt-12 pb-16 sm:pt-16">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Editable
          path="hero.kicker"
          text={hero.kicker}
          as="p"
          className="text-[11px] uppercase tracking-[0.18em] text-pencil"
        />
        <Stamp>
          <EditableInline path="hero.stamp" text={hero.stamp} />
        </Stamp>
      </div>
      <Editable
        path="hero.name"
        text={hero.name}
        as="h1"
        className="font-display text-5xl leading-[1.05] text-ink sm:text-6xl"
      />
      <Editable
        path="hero.lede"
        text={hero.lede}
        as="p"
        className="mt-5 max-w-xl text-[17px] leading-relaxed text-graphite"
      >
        {splitHighlights(hero.lede, hero.highlights).map((segment, i) =>
          segment.mark ? (
            <Highlight key={i}>{segment.text}</Highlight>
          ) : (
            <span key={i}>{segment.text}</span>
          ),
        )}
      </Editable>
      <div className="mt-8">
        <MarginNote>&#8599; two careers, one set of tools</MarginNote>
      </div>
    </section>
  )
}
