// Two distinct email addresses are involved in the contact flow:
// CONTACT_TO_EMAIL (private, read only by lib/contact/mailer.ts to decide
// where the working form's email is actually delivered) and
// PUBLIC_CONTACT_EMAIL (the address that is safe to publish, read by
// components/sections/Contact.tsx and rendered into ContactForm's
// <noscript> fallback, which lands in the raw HTML of every page).
//
// The regression this file guards against: Contact.tsx used to read
// CONTACT_TO_EMAIL directly and pass it straight into the noscript
// fallback, baking the owner's real delivery inbox into a place email
// harvesters read. The fix introduces PUBLIC_CONTACT_EMAIL as a separate
// variable and requires the fallback to fail closed, rendering no address
// at all, rather than falling back to CONTACT_TO_EMAIL, whenever
// PUBLIC_CONTACT_EMAIL is unset.
//
// These render with react-dom/server's renderToStaticMarkup, not
// @testing-library/react's client-side render(). That is deliberate, not
// incidental: verified empirically that React does not populate <noscript>
// children during a client-side render at all (childNodes.length === 0
// regardless of fallbackEmail, in both jsdom here and real browsers, since
// client-side JS is by definition running when that render happens). The
// <noscript> fallback this file is testing only ever reaches a real visitor
// through the initial server-rendered HTML, exactly what
// renderToStaticMarkup produces, so asserting against that string is what
// actually matches the no-JS scenario being protected, where a
// client-side-only assertion would silently test nothing.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Contact } from '@/components/sections/Contact'
import { ContactForm } from '@/components/ContactForm'

const sampleContact = { heading: 'Get in touch', blurb: 'Say hello.' }

describe('ContactForm noscript fallback (server-rendered HTML)', () => {
  it('fails closed: with no fallbackEmail, renders no "@" address and no mailto link', () => {
    const html = renderToStaticMarkup(<ContactForm fallbackEmail={undefined} />)
    const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html)
    expect(noscript, 'noscript block not found in server-rendered output').not.toBeNull()
    expect(noscript![1]).not.toContain('@')
    expect(noscript![1]).not.toContain('mailto:')
    // Still useful to a no-JS visitor: says the form needs JavaScript,
    // rather than rendering an empty/blank fallback.
    expect(noscript![1]).toContain('JavaScript')
  })

  it('renders the given address as a mailto link when one is provided', () => {
    const html = renderToStaticMarkup(<ContactForm fallbackEmail="hello@example.com" />)
    const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html)
    expect(noscript).not.toBeNull()
    expect(noscript![1]).toContain('mailto:hello@example.com')
  })
})

describe('Contact section reads PUBLIC_CONTACT_EMAIL, never CONTACT_TO_EMAIL, for the published address', () => {
  // Both variables are saved and restored around every test in this block:
  // tests/setup.ts preloads .env.local into process.env before the run
  // (real values this suite must never read from or print), so each test
  // here explicitly controls both instead of assuming either is unset.
  function withEnv(
    values: { PUBLIC_CONTACT_EMAIL?: string; CONTACT_TO_EMAIL?: string },
    fn: () => void,
  ) {
    const originalPublic = process.env.PUBLIC_CONTACT_EMAIL
    const originalDelivery = process.env.CONTACT_TO_EMAIL
    if (values.PUBLIC_CONTACT_EMAIL === undefined) delete process.env.PUBLIC_CONTACT_EMAIL
    else process.env.PUBLIC_CONTACT_EMAIL = values.PUBLIC_CONTACT_EMAIL
    if (values.CONTACT_TO_EMAIL === undefined) delete process.env.CONTACT_TO_EMAIL
    else process.env.CONTACT_TO_EMAIL = values.CONTACT_TO_EMAIL
    try {
      fn()
    } finally {
      if (originalPublic === undefined) delete process.env.PUBLIC_CONTACT_EMAIL
      else process.env.PUBLIC_CONTACT_EMAIL = originalPublic
      if (originalDelivery === undefined) delete process.env.CONTACT_TO_EMAIL
      else process.env.CONTACT_TO_EMAIL = originalDelivery
    }
  }

  it('fails closed: PUBLIC_CONTACT_EMAIL unset renders no "@" address anywhere, even with CONTACT_TO_EMAIL set', () => {
    withEnv(
      { PUBLIC_CONTACT_EMAIL: undefined, CONTACT_TO_EMAIL: 'owner-private@example.com' },
      () => {
        const html = renderToStaticMarkup(<Contact contact={sampleContact} />)
        expect(html).not.toContain('@')
        expect(html).not.toContain('owner-private@example.com')
      },
    )
  })

  it('publishes PUBLIC_CONTACT_EMAIL when set, and never the CONTACT_TO_EMAIL value', () => {
    withEnv(
      {
        PUBLIC_CONTACT_EMAIL: 'public-hello@example.com',
        CONTACT_TO_EMAIL: 'owner-private@example.com',
      },
      () => {
        const html = renderToStaticMarkup(<Contact contact={sampleContact} />)
        expect(html).toContain('public-hello@example.com')
        expect(html).not.toContain('owner-private@example.com')
      },
    )
  })
})

// A static-source check alongside the rendering tests above: confirms
// Contact.tsx never reads process.env.CONTACT_TO_EMAIL at all (mentioning
// the name in an explanatory comment, as the current source does, is fine
// and does not trip this; only the actual property access does). The
// rendering tests above prove the observable behaviour is correct for the
// env var combinations exercised; this closes the gap where a future edit
// reads CONTACT_TO_EMAIL as a secondary fallback (e.g.
// `process.env.PUBLIC_CONTACT_EMAIL ?? process.env.CONTACT_TO_EMAIL`) that
// happens not to be exercised by those specific combinations.
describe('Contact.tsx source never reads process.env.CONTACT_TO_EMAIL', () => {
  it('has no process.env.CONTACT_TO_EMAIL property access', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../components/sections/Contact.tsx'),
      'utf8',
    )
    expect(source).not.toContain('process.env.CONTACT_TO_EMAIL')
  })
})
