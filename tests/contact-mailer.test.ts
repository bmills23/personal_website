import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendContactEmail, MailerNotConfiguredError } from '@/lib/contact/mailer'

// These tests never reach the network: in every case exercised here, the
// missing-configuration branch throws or returns before `resend.emails.send`
// is ever called. RESEND_API_KEY and CONTACT_TO_EMAIL are unset in this
// repo's .env.local by design (see tests/setup.ts), which is what makes
// that branch the one that runs.

const input = { name: 'Ada', email: 'ada@example.com', body: 'Hello there.', website: '' }

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const original: Record<string, string | undefined> = {}
  for (const key of Object.keys(overrides)) {
    original[key] = process.env[key]
    if (overrides[key] === undefined) delete process.env[key]
    else process.env[key] = overrides[key]
  }
  try {
    return fn()
  } finally {
    for (const key of Object.keys(original)) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  }
}

describe('sendContactEmail without Resend configured', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('in development, prints the submission and resolves without throwing', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await withEnv(
      { NODE_ENV: 'development', RESEND_API_KEY: undefined, CONTACT_TO_EMAIL: undefined },
      async () => {
        await expect(sendContactEmail(input)).resolves.toBeUndefined()
      },
    )
    expect(logSpy).toHaveBeenCalled()
  })

  it('in production, throws MailerNotConfiguredError instead of silently succeeding', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await withEnv(
      { NODE_ENV: 'production', RESEND_API_KEY: undefined, CONTACT_TO_EMAIL: undefined },
      async () => {
        await expect(sendContactEmail(input)).rejects.toBeInstanceOf(MailerNotConfiguredError)
      },
    )
  })

  it('in production, never logs the name, email, or body when configuration is missing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await withEnv(
      { NODE_ENV: 'production', RESEND_API_KEY: undefined, CONTACT_TO_EMAIL: undefined },
      async () => {
        await sendContactEmail(input).catch(() => {})
      },
    )
    const logged = errorSpy.mock.calls.flat().map((arg) => String(arg)).join('\n')
    expect(logged).not.toContain(input.email)
    expect(logged).not.toContain(input.body)
    expect(logged).not.toContain(input.name)
  })
})
