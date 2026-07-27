import type { Metadata } from 'next'
import { Fraunces, Inter, Caveat } from 'next/font/google'
import { PaperBackground } from '@/components/shell/PaperBackground'
import { Nav } from '@/components/shell/Nav'
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
    'Geologist-in-Training for the State of Colorado and founder of TerminaLLM LLC, building TerminaLLM and Parolejo.',
  metadataBase: new URL('https://bryangmills.com'),
  openGraph: {
    title: 'Bryan G. Mills',
    description:
      'Geologist-in-Training for the State of Colorado and founder of TerminaLLM LLC.',
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
    >
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <PaperBackground />
        <Nav />
        {children}
      </body>
    </html>
  )
}
