import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bryan G. Mills',
  description: 'Geologist-in-Training for the State of Colorado and founder of TerminaLLM LLC.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
