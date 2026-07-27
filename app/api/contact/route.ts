import { NextResponse } from 'next/server'
import { contactInputSchema } from '@/lib/contact/schema'
import { hashIp, isRateLimited } from '@/lib/contact/rateLimit'
import { sendContactEmail } from '@/lib/contact/mailer'
import { getSql } from '@/lib/db'

export async function POST(request: Request) {
  const parsed = contactInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    // A filled honeypot lands here too. Return the same generic error so a bot
    // learns nothing about why it failed.
    return NextResponse.json({ error: 'Invalid submission.' }, { status: 400 })
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const ipHash = hashIp(ip)

  if (await isRateLimited(ipHash)) {
    return NextResponse.json(
      { error: 'Too many messages. Try again later.' },
      { status: 429 },
    )
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
    // The message is safely stored, so the sender is told the truth: received.
    console.error('[contact] resend failed, message is stored', error instanceof Error ? error.name : 'unknown error')
  }

  return NextResponse.json({ ok: true })
}
