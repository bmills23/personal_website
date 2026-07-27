import type { Content } from '@/lib/content/schema'
import { WrittenHeading } from '@/components/shell/WrittenHeading'
import { ContactForm } from '@/components/ContactForm'

export function Contact({ contact }: { contact: Content['contact'] }) {
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
        <ContactForm />
      </div>
    </section>
  )
}
