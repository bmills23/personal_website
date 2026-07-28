import { createHash } from 'node:crypto'
import { describe, it, expect, afterEach } from 'vitest'
import { hashIp, isRateLimited } from '@/lib/contact/rateLimit'
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

// Security-audit Fix 2: hashIp used to fall back to a fixed, publicly-known
// salt ('unsalted') whenever AUTH_SECRET was absent, which makes a stored
// ip_hash trivially reversible (the IPv4 space is enumerable) - a privacy
// measure that was actually storing PII. hashIp now prefers a dedicated
// CONTACT_IP_SALT, then AUTH_SECRET, then a random per-process salt; never
// the old fixed constant.
describe('hashIp salt preference (audit Fix 2)', () => {
  const originalAuthSecret = process.env.AUTH_SECRET
  const originalContactIpSalt = process.env.CONTACT_IP_SALT

  afterEach(() => {
    if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET
    else process.env.AUTH_SECRET = originalAuthSecret
    if (originalContactIpSalt === undefined) delete process.env.CONTACT_IP_SALT
    else process.env.CONTACT_IP_SALT = originalContactIpSalt
  })

  it('prefers CONTACT_IP_SALT over AUTH_SECRET when both are set', () => {
    process.env.AUTH_SECRET = 'secret-a'
    process.env.CONTACT_IP_SALT = 'salt-1'
    const withSalt1 = hashIp('9.9.9.9')
    process.env.CONTACT_IP_SALT = 'salt-2'
    const withSalt2 = hashIp('9.9.9.9')
    // AUTH_SECRET never changed; only CONTACT_IP_SALT did. The hash
    // changing anyway proves CONTACT_IP_SALT is what is actually salting.
    expect(withSalt1).not.toBe(withSalt2)
  })

  it('falls back to AUTH_SECRET when CONTACT_IP_SALT is unset, unchanged from today\'s behavior', () => {
    delete process.env.CONTACT_IP_SALT
    process.env.AUTH_SECRET = 'secret-a'
    const withA = hashIp('9.9.9.9')
    process.env.AUTH_SECRET = 'secret-b'
    const withB = hashIp('9.9.9.9')
    expect(withA).not.toBe(withB)
  })

  it('never reproduces the old fixed "unsalted" constant when neither env var is configured', () => {
    delete process.env.CONTACT_IP_SALT
    delete process.env.AUTH_SECRET
    const legacyUnsaltedHash = createHash('sha256')
      .update('unsalted:9.9.9.9')
      .digest('hex')
      .slice(0, 32)
    expect(hashIp('9.9.9.9')).not.toBe(legacyUnsaltedHash)
  })

  it('stays deterministic for the same address within this process with neither env var configured', () => {
    delete process.env.CONTACT_IP_SALT
    delete process.env.AUTH_SECRET
    expect(hashIp('9.9.9.9')).toBe(hashIp('9.9.9.9'))
  })

  it('still differs between addresses with neither env var configured', () => {
    delete process.env.CONTACT_IP_SALT
    delete process.env.AUTH_SECRET
    expect(hashIp('9.9.9.9')).not.toBe(hashIp('9.9.9.10'))
  })
})

describe('isRateLimited fails open on a database error', () => {
  // Same technique as the "falls back to the seed" test in
  // tests/read.test.ts: an unreachable local address fails fast
  // (connection refused) without depending on the real project database or
  // any external network. This directly exercises the fail-open behavior
  // documented in lib/contact/rateLimit.ts: an outage of the rate-limit
  // check itself must resolve to "not rate limited" rather than throwing
  // or blocking a legitimate sender.
  it('resolves to false, rather than throwing or blocking, when the database is unreachable', async () => {
    const original = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'postgresql://nobody:nothing@127.0.0.1:1/none'
    try {
      await expect(isRateLimited('some-hash')).resolves.toBe(false)
    } finally {
      process.env.DATABASE_URL = original
    }
  }, 20000)
})
