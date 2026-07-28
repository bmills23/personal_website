import type { Metadata } from 'next'
import { Fraunces, Inter, Caveat } from 'next/font/google'
import { PaperBackground } from '@/components/shell/PaperBackground'
import { Nav } from '@/components/shell/Nav'
import { EditProvider } from '@/components/editor/EditProvider'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
})
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})
const caveat = Caveat({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600'],
  variable: '--font-caveat',
})

export const metadata: Metadata = {
  title: 'Bryan G. Mills',
  description:
    'Environmental Protection Specialist for the State of Colorado and founder of TerminaLLM LLC, building TerminaLLM and Parolejo.',
  metadataBase: new URL('https://bryangmills.com'),
  openGraph: {
    title: 'Bryan G. Mills',
    description:
      'Environmental Protection Specialist for the State of Colorado and founder of TerminaLLM LLC.',
    url: 'https://bryangmills.com',
    siteName: 'Bryan G. Mills',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${caveat.variable}`}
      // The inline head script below adds js-ready to this element before
      // React hydrates, so the DOM's className will not match the
      // server-rendered value at hydration time. Scoped to <html> only: this
      // tells React to accept the DOM's actual value here rather than
      // warning about (or, on other elements/attributes, potentially
      // patching back) the mismatch. Do not add this to <body> or elsewhere;
      // it is a targeted escape hatch, not a blanket suppression.
      suppressHydrationWarning
    >
      <head>
        {/* Static string, not user content. Runs synchronously before paint
            so there is no flash of visible-then-hidden text: the writing
            animation CSS only clips [data-write] content once this class is
            present, so no JavaScript means no class means no clipping. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('js-ready')`,
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <PaperBackground />
        <Nav />
        <EditProvider>{children}</EditProvider>
      </body>
    </html>
  )
}
