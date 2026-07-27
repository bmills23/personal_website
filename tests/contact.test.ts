import { describe, it, expect } from 'vitest'
import { hashIp } from '@/lib/contact/rateLimit'
import { contactInputSchema } from '@/lib/contact/schema'

describe('hashIp', () => {
  it('is deterministic', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'))
  })
  it('differs between addresses', () => {
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('1.2.3.5'))
  })
  it('does not contain the raw address', () => {
    expect(hashIp('1.2.3.4')).not.toContain('1.2.3.4')
  })
})

describe('contactInputSchema', () => {
  const valid = { name: 'Ada', email: 'ada@example.com', body: 'Hello there.', website: '' }

  it('accepts a valid submission', () => {
    expect(contactInputSchema.safeParse(valid).success).toBe(true)
  })
  it('rejects a bad email', () => {
    expect(contactInputSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false)
  })
  it('rejects an empty body', () => {
    expect(contactInputSchema.safeParse({ ...valid, body: '' }).success).toBe(false)
  })
  it('rejects an over-long body', () => {
    expect(contactInputSchema.safeParse({ ...valid, body: 'x'.repeat(5001) }).success).toBe(false)
  })
  it('rejects a filled honeypot', () => {
    expect(contactInputSchema.safeParse({ ...valid, website: 'http://spam' }).success).toBe(false)
  })
})
