import type { Content } from '@/lib/content/schema'
import { Stamp } from '@/components/shell/Stamp'
import { MarginNote } from '@/components/shell/MarginNote'

/**
 * The hero's h1 is the page's Largest Contentful Paint element and the
 * owner's explicit call was scroll-triggered motion only, so it renders as a
 * plain heading: no WrittenHeading, no Reveal. Do not wrap it.
 */
export function Hero({ hero }: { hero: Content['hero'] }) {
  return (
    <section className="relative pt-12 pb-16 sm:pt-16">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-pencil">
          {hero.kicker}
        </p>
        <Stamp>{hero.stamp}</Stamp>
      </div>
      <h1 className="font-display text-5xl leading-[1.05] text-ink sm:text-6xl">
        {hero.name}
      </h1>
      <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-graphite">
        {hero.lede}
      </p>
      <div className="mt-8">
        <MarginNote>&#8599; two careers, one set of tools</MarginNote>
      </div>
    </section>
  )
}
