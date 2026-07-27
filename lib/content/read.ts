import { cacheTag } from 'next/cache'
import { getSql } from '@/lib/db'
import { contentSchema, type Content } from '@/lib/content/schema'
import seed from '@/seed/content.json'

const seedParse = contentSchema.safeParse(seed)
if (!seedParse.success) {
  const fields = seedParse.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
  throw new Error(
    `seed/content.json failed schema validation. This is the fallback document, so a bad ` +
      `seed must fail loudly at build time rather than degrade silently. Invalid fields:\n` +
      fields.join('\n'),
  )
}
const SEED = seedParse.data

/**
 * Reads the content document straight from Postgres, falling back to the
 * checked-in seed if the database is unreachable or holds an invalid document.
 * The site staying up through a database incident is worth these few lines.
 */
export async function readContentUncached(): Promise<Content> {
  try {
    const sql = getSql()
    const rows = await sql`select doc from content where id = 1`
    if (rows.length === 0) return SEED
    const parsed = contentSchema.safeParse(rows[0].doc)
    if (!parsed.success) {
      // zod issues describe the content document, not the connection, so they are safe to log.
      console.error('content document failed validation, serving seed', parsed.error.issues)
      return SEED
    }
    return parsed.data
  } catch (error) {
    // Never log the raw error here: a malformed DATABASE_URL makes the neon()
    // factory throw an Error whose message embeds the full connection string,
    // credentials included. Log a fixed message plus only the error name.
    console.error('content read failed, serving seed', error instanceof Error ? error.name : 'unknown error')
    return SEED
  }
}

export async function getContent(): Promise<Content> {
  'use cache'
  cacheTag('content')
  return readContentUncached()
}
