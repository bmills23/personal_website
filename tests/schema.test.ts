import { describe, it, expect } from 'vitest'
import { contentSchema } from '@/lib/content/schema'
import seed from '@/seed/content.json'

describe('contentSchema', () => {
  it('accepts the seed document', () => {
    const result = contentSchema.safeParse(seed)
    if (!result.success) console.error(result.error.issues)
    expect(result.success).toBe(true)
  })

  it('rejects a document missing hero', () => {
    const { hero, ...rest } = seed as Record<string, unknown>
    expect(contentSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a product without a name', () => {
    const bad = structuredClone(seed) as any
    delete bad.products[0].name
    expect(contentSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects a store link that is not a URL', () => {
    const bad = structuredClone(seed) as any
    bad.products[0].links[0].url = 'not-a-url'
    expect(contentSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects a store link using the javascript: scheme', () => {
    const bad = structuredClone(seed) as any
    bad.products[0].links[0].url = 'javascript:alert(1)'
    expect(contentSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects a store link using the data: scheme', () => {
    const bad = structuredClone(seed) as any
    bad.products[0].links[0].url = 'data:text/html,x'
    expect(contentSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts a normal https store link', () => {
    const good = structuredClone(seed) as any
    good.products[0].links[0].url = 'https://example.com'
    expect(contentSchema.safeParse(good).success).toBe(true)
  })
})
