import { getContent } from '@/lib/content/read'
import { Footer } from '@/components/shell/Footer'
import { TapedCard } from '@/components/shell/TapedCard'

export default async function Home() {
  const content = await getContent()
  return (
    <>
      <main id="main" className="mx-auto max-w-4xl px-5 pt-10 sm:px-8">
        <TapedCard>
          <h1 className="font-display text-3xl text-ink">{content.hero.name}</h1>
        </TapedCard>
      </main>
      <Footer note={content.footer.note} links={content.footer.links} />
    </>
  )
}
