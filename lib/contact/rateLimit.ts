import { createHash } from 'node:crypto'
import { getSql } from '@/lib/db'

const WINDOW_MINUTES = 60
const MAX_PER_WINDOW = 5

export function hashIp(ip: string): string {
  const salt = process.env.AUTH_SECRET ?? 'unsalted'
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
