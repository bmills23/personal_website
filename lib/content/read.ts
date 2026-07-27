import { cacheTag } from 'next/cache'
import { getSql } from '@/lib/db'
import { contentSchema, type Content } from '@/lib/content/schema'
import seed from '@/seed/content.json'

const SEED = contentSchema.parse(seed)

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
      console.error('content document failed validation, serving seed', parsed.error.issues)
      return SEED
    }
    return parsed.data
  } catch (error) {
    console.error('content read failed, serving seed', error)
    return SEED
  }
}

export async function getContent(): Promise<Content> {
  'use cache'
  cacheTag('content')
  return readContentUncached()
}
