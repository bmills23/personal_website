import { describe, it, expect } from 'vitest'
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
})
