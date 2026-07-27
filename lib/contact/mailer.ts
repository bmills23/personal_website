import { Resend } from 'resend'
import type { ContactInput } from '@/lib/contact/schema'

/**
 * Thrown when mail is not configured (RESEND_API_KEY or CONTACT_TO_EMAIL
 * missing) in production, before any attempt to send was made. Distinct
 * from a genuine Resend failure (network error, Resend outage, rejected
 * send): the message is safely stored in Postgres either way, but only a
 * real send attempt that failed can honestly be reported to the sender as
 * "received, the delivery step just had trouble". A missing configuration
 * means the delivery step was never attempted at all, so the caller must
 * not tell the sender the message went out.
 */
export class MailerNotConfiguredError extends Error {
  constructor() {
    super('Mail is not configured (RESEND_API_KEY or CONTACT_TO_EMAIL missing)')
    this.name = 'MailerNotConfiguredError'
  }
}

export async function sendContactEmail(input: ContactInput): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const to = process.env.CONTACT_TO_EMAIL

  if (!key || !to) {
    if (process.env.NODE_ENV !== 'production') {
      // Development convenience: no email account is needed to build or
      // test this. Safe to print the submission here because a dev
      // submission is the developer's own test input, not a stranger's
      // personal details reaching a shared log.
      console.log('[contact] no Resend config, printing instead:\n', input)
      return
    }
    // In production, a missing configuration is a deploy hazard, not a
    // normal outage: silently printing and returning would mean every
    // message is swallowed while a stranger's name, email, and message
    // body get written into server logs, and the sender is told it was
    // delivered. Fail loudly instead, and never log the submission
    // contents here.
    console.error('[contact] RESEND_API_KEY or CONTACT_TO_EMAIL is not set in production')
    throw new MailerNotConfiguredError()
  }

  const resend = new Resend(key)
  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to,
    replyTo: input.email,
    subject: `bryangmills.com: ${input.name}`,
    text: `From: ${input.name} <${input.email}>\n\n${input.body}`,
  })
}
