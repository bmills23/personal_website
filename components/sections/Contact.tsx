import type { Content } from '@/lib/content/schema'
import { WrittenHeading } from '@/components/shell/WrittenHeading'
import { ContactForm } from '@/components/ContactForm'

export function Contact({ contact }: { contact: Content['contact'] }) {
  // Server-only: read directly here rather than threading it through props
  // from a higher layer, and never logged or otherwise surfaced except as
  // the mailto fallback below. This is the address the contact form itself
  // delivers to (see lib/contact/mailer.ts), so publishing it as a no-JS
  // fallback tells the visitor nothing the working form does not already
  // reveal as its destination.
  const fallbackEmail = process.env.CONTACT_TO_EMAIL
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
        <ContactForm fallbackEmail={fallbackEmail} />
      </div>
    </section>
  )
}
