import { NextResponse } from 'next/server'
import { contactInputSchema } from '@/lib/contact/schema'
import { hashIp, isRateLimited } from '@/lib/contact/rateLimit'
import { sendContactEmail, MailerNotConfiguredError } from '@/lib/contact/mailer'
import { getSql } from '@/lib/db'

// The schema caps the message body at 5000 characters, so a JSON envelope
// around name/email/body/website comfortably fits in a few KB. Tens of
// kilobytes is a generous ceiling that still rejects an attempt to post an
// oversized payload at this endpoint before it is ever parsed.
const MAX_BODY_BYTES = 20_000

export async function POST(request: Request) {
  // Rate limit first, ahead of every other check, so a malformed request,
  // an oversized body, and a filled honeypot all count against the limit
  // the same as a valid one. Checking this last would mean the traffic
  // most likely to be an attack is the only traffic that is never rate
  // limited.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const ipHash = hashIp(ip)

  if (await isRateLimited(ipHash)) {
    return NextResponse.json(
      { error: 'Too many messages. Try again later.' },
      { status: 429 },
    )
  }

  // Reject oversized bodies before parsing. content-length can be absent or
  // spoofed, so this is a cheap first gate, not a guarantee; the schema's
  // own 5000-character cap on body is the real bound once parsed.
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Invalid submission.' }, { status: 400 })
  }

  const parsed = contactInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    // A filled honeypot lands here too. Return the same generic error so a bot
    // learns nothing about why it failed.
    return NextResponse.json({ error: 'Invalid submission.' }, { status: 400 })
  }

  const { name, email, body } = parsed.data

  // Persist BEFORE sending: a Resend outage must not lose a message.
  try {
    const sql = getSql()
    await sql`insert into messages (name, email, body, ip_hash)
              values (${name}, ${email}, ${body}, ${ipHash})`
  } catch (error) {
    console.error('[contact] failed to persist message', error instanceof Error ? error.name : 'unknown error')
    return NextResponse.json(
      { error: 'Could not send right now. Please email me directly.' },
      { status: 500 },
    )
  }

  try {
    await sendContactEmail(parsed.data)
  } catch (error) {
    if (error instanceof MailerNotConfiguredError) {
      // No send attempt was ever made, so telling the sender it was
      // delivered would be a lie even though the row is safely stored.
      // This is the one send-failure case that surfaces as an error.
      console.error('[contact] mail not configured, message is stored')
      return NextResponse.json(
        { error: 'Could not send right now. Please email me directly.' },
        { status: 500 },
      )
    }
    // A genuine Resend outage: the message is safely stored, so the sender
    // is told the truth: received.
    console.error('[contact] resend failed, message is stored', error instanceof Error ? error.name : 'unknown error')
  }

  return NextResponse.json({ ok: true })
}
