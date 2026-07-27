import { getContent } from '@/lib/content/read'
import { Hero } from '@/components/sections/Hero'
import { About } from '@/components/sections/About'
import { Products } from '@/components/sections/Products'
import { Tracks } from '@/components/sections/Tracks'
import { Footer } from '@/components/shell/Footer'

export default async function Home() {
  const content = await getContent()
  return (
    <>
      <main id="main" className="mx-auto max-w-4xl px-5 sm:px-8">
        <Hero hero={content.hero} />
        <About about={content.about} />
        <Products products={content.products} kicker={content.sections.products.kicker} />
        <Tracks tracks={content.tracks} kicker={content.sections.work.kicker} />
      </main>
      <Footer note={content.footer.note} links={content.footer.links} />
    </>
  )
}
