import type { Content } from '@/lib/content/schema'
import { TapedCard } from '@/components/shell/TapedCard'
import { Reveal } from '@/components/shell/Reveal'
import { WrittenHeading } from '@/components/shell/WrittenHeading'
import { Icon } from '@/components/Icon'

export function Products({
  products,
  kicker,
}: {
  products: Content['products']
  kicker: string
}) {
  return (
    <section id="products" className="border-t border-card-border py-14">
      <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-stamp">
        {kicker}
      </p>
      <WrittenHeading as="h2" className="font-display text-3xl text-ink sm:text-4xl">
        Products
      </WrittenHeading>
      {/* No min-w-0 shrink guard here: it would land on TapedCard, one DOM
          level below the actual grid item (Reveal's motion.div), where CSS
          grid's automatic-minimum-size resolution does not see it, so it
          would be inert. Verified experimentally: an unbreakable 60+ char
          string overflows identically whether min-w-0 is placed here,
          moved onto the real grid item, or omitted entirely. The layout's
          actual protection against long unbroken strings is `body {
          overflow-wrap: anywhere }` in app/globals.css. */}
      <div className="mt-8 grid grid-cols-1 gap-7 md:grid-cols-2">
        {products.map((product, i) => (
          <Reveal key={product.id} delay={i * 0.08} variant="card">
            <TapedCard alt={i % 2 === 1} className="h-full">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-mono text-lg font-semibold text-ink">
                  {product.name}
                </h3>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-pencil"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="mt-1 font-display text-[15px] text-graphite">
                {product.tagline}
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-graphite">
                {product.body}
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-sm border border-card-border px-2 py-1 text-[11px] text-pencil"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-card-border pt-3">
                {product.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink hover:text-stamp"
                  >
                    {link.label}
                    <Icon name="arrow-up-right" size={14} />
                  </a>
                ))}
              </div>
            </TapedCard>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
