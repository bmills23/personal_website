import { describe, it, expect, vi, beforeEach } from 'vitest'

// Every dependency that would otherwise touch the network or the real
// database is mocked, so this file needs neither. It exists to cover the
// properties that were previously verified once by hand with curl against a
// running dev server: persist-before-send ordering, the honeypot and other
// validation failures sharing one response, malformed JSON handling, the
// oversized-body gate, and the rate limiter running ahead of every other
// check.

const calls: string[] = []

vi.mock('@/lib/contact/rateLimit', () => ({
  hashIp: vi.fn(() => 'hash'),
  isRateLimited: vi.fn(async () => false),
}))

vi.mock('@/lib/db', () => ({
  getSql: vi.fn(() => {
    const sql = async (_strings: TemplateStringsArray, ..._values: unknown[]) => {
      calls.push('db-insert')
      return [{ n: 0 }]
    }
    return sql
  }),
}))

vi.mock('@/lib/contact/mailer', () => {
  class MailerNotConfiguredError extends Error {}
  return {
    MailerNotConfiguredError,
    sendContactEmail: vi.fn(async () => {
      calls.push('mail-send')
    }),
  }
})

import { POST } from '@/app/api/contact/route'
import { isRateLimited } from '@/lib/contact/rateLimit'
import { sendContactEmail, MailerNotConfiguredError } from '@/lib/contact/mailer'

const valid = { name: 'Ada', email: 'ada@example.com', body: 'Hello there.', website: '' }

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: payload,
  })
}

beforeEach(() => {
  calls.length = 0
  vi.mocked(isRateLimited).mockReset().mockResolvedValue(false)
  vi.mocked(sendContactEmail).mockReset().mockImplementation(async () => {
    calls.push('mail-send')
  })
})

describe('POST /api/contact, mocked db and mailer', () => {
  it('inserts into the database before attempting to send email', async () => {
    const res = await POST(makeRequest(valid))
    expect(res.status).toBe(200)
    expect(calls).toEqual(['db-insert', 'mail-send'])
  })

  it('still reports success when the send fails but the row is already stored', async () => {
    vi.mocked(sendContactEmail).mockRejectedValueOnce(new Error('network down'))
    const res = await POST(makeRequest(valid))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(calls).toEqual(['db-insert'])
  })

  it('reports an honest error, not success, when mail is not configured', async () => {
    vi.mocked(sendContactEmail).mockRejectedValueOnce(new MailerNotConfiguredError())
    const res = await POST(makeRequest(valid))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Could not send right now. Please email me directly.' })
  })

  it('returns the identical generic 400 for a filled honeypot and for an ordinary invalid field', async () => {
    const honeypotRes = await POST(
      makeRequest({ name: 'Bot', email: 'bot@example.com', body: 'x', website: 'http://spam' }),
    )
    const badEmailRes = await POST(makeRequest({ ...valid, email: 'not-an-email' }))
    expect(honeypotRes.status).toBe(400)
    expect(badEmailRes.status).toBe(400)
    expect(await honeypotRes.json()).toEqual(await badEmailRes.json())
  })

  it('rejects malformed JSON with the generic 400, not a 500', async () => {
    const res = await POST(makeRequest('not json'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid submission.' })
  })

  it('rejects an oversized body via content-length before parsing, even when the body itself is valid', async () => {
    const res = await POST(makeRequest(valid, { 'content-length': '50000' }))
    expect(res.status).toBe(400)
    expect(calls).toEqual([])
  })

  it('checks the rate limiter before validating the payload: a rate-limited honeypot request still returns 429, not 400', async () => {
    vi.mocked(isRateLimited).mockResolvedValueOnce(true)
    const res = await POST(
      makeRequest({ name: 'Bot', email: 'bot@example.com', body: 'x', website: 'http://spam' }),
    )
    expect(res.status).toBe(429)
    expect(calls).toEqual([])
  })

  it('does not attempt to persist when the request is rate limited', async () => {
    vi.mocked(isRateLimited).mockResolvedValueOnce(true)
    const res = await POST(makeRequest(valid))
    expect(res.status).toBe(429)
    expect(calls).toEqual([])
  })
})
