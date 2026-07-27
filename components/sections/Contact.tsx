import type { Content } from '@/lib/content/schema'
import { WrittenHeading } from '@/components/shell/WrittenHeading'
import { ContactForm } from '@/components/ContactForm'

export function Contact({ contact }: { contact: Content['contact'] }) {
  // Server-only: read directly here rather than threading it through props
  // from a higher layer. Deliberately NOT CONTACT_TO_EMAIL: that variable is
  // the private delivery address the working form's server route sends to
  // (see lib/contact/mailer.ts), and the working form itself never discloses
  // it, it only POSTs to /api/contact. PUBLIC_CONTACT_EMAIL is a separate,
  // intentionally publishable address for the no-JS fallback below, which
  // renders into the raw HTML of every page where email harvesters can read
  // it. If it is ever unset, ContactForm renders the fallback with no
  // address at all rather than falling back to the delivery address; see
  // the comment on the `fallbackEmail` prop there.
  const publicEmail = process.env.PUBLIC_CONTACT_EMAIL
  return (
    <section id="contact" className="border-t border-card-border py-14">
      <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-stamp">
        Say hello
      </p>
      <WrittenHeading as="h2" className="font-display text-3xl text-ink sm:text-4xl">
        {contact.heading}
      </WrittenHeading>
      {contact.blurb ? (
        <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-graphite">
          {contact.blurb}
        </p>
      ) : null}
      <div className="mt-7">
        <ContactForm fallbackEmail={publicEmail} />
      </div>
    </section>
  )
}
