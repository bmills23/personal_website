import { Resend } from 'resend'
import type { ContactInput } from '@/lib/contact/schema'

export async function sendContactEmail(input: ContactInput): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const to = process.env.CONTACT_TO_EMAIL

  if (!key || !to) {
    console.log('[contact] no Resend config, printing instead:\n', input)
    return
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
