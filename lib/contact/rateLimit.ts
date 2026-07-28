import { createHash, randomBytes } from 'node:crypto'
import { getSql } from '@/lib/db'

const WINDOW_MINUTES = 60
const MAX_PER_WINDOW = 5

// Generated at most once per process, only ever used as a last resort (see
// hashIp below), and never persisted anywhere. Kept in module state rather
// than regenerated per call so hashIp stays deterministic for the life of
// this process even in that fallback case.
let fallbackSalt: string | null = null
function getFallbackSalt(): string {
  if (fallbackSalt === null) fallbackSalt = randomBytes(32).toString('hex')
  return fallbackSalt
}

/**
 * Salts with, in preference order: a dedicated CONTACT_IP_SALT, then
 * AUTH_SECRET (today's default), then, only if NEITHER is configured, a
 * random salt generated once for this process.
 *
 * CONTACT_IP_SALT exists so rotating AUTH_SECRET - which invalidates every
 * editor session, see docs/EDITOR.md - does not also silently reset every
 * rate-limit bucket as a side effect; it is entirely optional, and omitting
 * it reproduces today's behavior exactly (AUTH_SECRET is still the salt).
 *
 * The random-salt fallback closes a real hole: hashing with a fixed,
 * publicly-known constant (this function's previous behavior whenever
 * AUTH_SECRET was unset) is trivially reversible, since the IPv4 address
 * space is small enough to enumerate wholesale - turning what is meant to
 * be a privacy measure into stored PII. A random per-process salt keeps the
 * hash non-reversible while staying deterministic within one running
 * process, so hashIp(ip) is still stable for that process's lifetime and
 * the rate limiter's grouping keeps working; it is NOT stable across
 * restarts, so in this fallback-only configuration buckets reset on every
 * process restart, which is an acceptable trade-off for an already
 * misconfigured deployment (no AUTH_SECRET means the editor itself is also
 * unconfigured, see lib/auth/index.ts's authConfigured()) and strictly
 * better than a hash anyone can reverse.
 */
export function hashIp(ip: string): string {
  const salt = process.env.CONTACT_IP_SALT || process.env.AUTH_SECRET || getFallbackSalt()
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

export async function isRateLimited(ipHash: string): Promise<boolean> {
  try {
    const sql = getSql()
    const rows = await sql`
      select count(*)::int as n from messages
      where ip_hash = ${ipHash}
        and created_at > now() - make_interval(mins => ${WINDOW_MINUTES})`
    return rows[0].n >= MAX_PER_WINDOW
  } catch (error) {
    // Fails open: a database error here returns "not rate limited" rather
    // than throwing or reporting limited. The alternative (failing closed)
    // would let an unrelated database blip lock out a legitimate sender,
    // which is worse than the rate limiter being briefly ineffective during
    // that same outage. The insert in the route handler below has its own
    // try/catch and does not depend on this decision either way.
    //
    // Still log it: a bare catch with no signal means a database outage
    // silently disables rate limiting with nothing to alert on. Same rule as
    // lib/content/read.ts and app/api/contact/route.ts: a fixed message plus
    // only the error name, never the error object or its message, since a
    // malformed DATABASE_URL throws an Error whose message embeds the full
    // connection string.
    console.error(
      '[contact] rate limit check failed, allowing request',
      error instanceof Error ? error.name : 'unknown error',
    )
    return false
  }
}
