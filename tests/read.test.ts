import { describe, it, expect, vi } from 'vitest'
import { readContentUncached } from '@/lib/content/read'
import { contentSchema } from '@/lib/content/schema'

describe('readContentUncached', () => {
  it('returns a schema-valid document from the database', async () => {
    const content = await readContentUncached()
    expect(contentSchema.safeParse(content).success).toBe(true)
    expect(content.hero.name).toBe('Bryan G. Mills')
  })

  it('falls back to the seed when the database is unreachable', async () => {
    const original = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'postgresql://nobody:nothing@127.0.0.1:1/none'
    try {
      const content = await readContentUncached()
      expect(content.hero.name).toBe('Bryan G. Mills')
      expect(content.version).toBe(1)
    } finally {
      process.env.DATABASE_URL = original
    }
  }, 20000)

  it('never logs the credential when DATABASE_URL is malformed', async () => {
    const original = process.env.DATABASE_URL
    const credential = 'CREDENTIAL_SHOULD_NOT_APPEAR_IN_LOGS'
    // A string that fails the neon() factory's own URL parsing (not merely an
    // unreachable host) is what makes it throw an Error whose message embeds
    // the raw connection string.
    process.env.DATABASE_URL = `not-a-valid-postgres-url-${credential}`
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const content = await readContentUncached()
      expect(content.hero.name).toBe('Bryan G. Mills')

      const logged = errorSpy.mock.calls.flat().map((arg) => String(arg)).join('\n')
      expect(logged).not.toContain(credential)
    } finally {
      process.env.DATABASE_URL = original
      errorSpy.mockRestore()
    }
  })
})
