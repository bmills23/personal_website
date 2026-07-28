import { z } from 'zod'
import { getSql } from '@/lib/db'
import { isEditablePath } from './paths'
import { contentSchema, productSchema, trackEntrySchema, type Content } from './schema'

export type ApplyResult =
  | { ok: true; doc: Content; unchanged: boolean }
  | { ok: false; reason: 'path' | 'missing' | 'invalid' }

/** Control characters (including newlines) never belong in these
 * single-paragraph fields; Enter commits an edit rather than inserting a
 * break, so any that arrive were injected, not typed. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/

export function applyFieldChange(doc: Content, path: string, value: string): ApplyResult {
  if (!isEditablePath(path)) return { ok: false, reason: 'path' }
  if (typeof value !== 'string' || CONTROL_CHARS.test(value)) return { ok: false, reason: 'invalid' }

  const segments = path.split('.')
  const next = structuredClone(doc) as unknown as Record<string, unknown>
  let node: unknown = next
  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(node)) {
      node = node[Number(segment)]
    } else if (node !== null && typeof node === 'object') {
      node = (node as Record<string, unknown>)[segment]
    } else {
      node = undefined
    }
    if (node === undefined) return { ok: false, reason: 'missing' }
  }

  const leaf = segments[segments.length - 1]
  const container = node
  let current: unknown
  if (Array.isArray(container)) {
    current = container[Number(leaf)]
  } else if (container !== null && typeof container === 'object') {
    current = (container as Record<string, unknown>)[leaf]
  }
  // The allowlist only names string leaves; anything else at this position
  // means the path does not exist in THIS document (e.g. products.5.name
  // when there are two products), which jsonb_set-style writes would
  // silently no-op on. Reject loudly instead.
  if (typeof current !== 'string') return { ok: false, reason: 'missing' }

  if (current === value) return { ok: true, doc, unchanged: true }

  if (Array.isArray(container)) {
    container[Number(leaf)] = value
  } else {
    ;(container as Record<string, unknown>)[leaf] = value
  }

  const parsed = contentSchema.safeParse(next)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return { ok: true, doc: parsed.data, unchanged: false }
}

const ARRAY_KEY_RE = /^(products|tracks\.(\d)\.entries)$/
const productsArraySchema = z.array(productSchema)
const entriesArraySchema = z.array(trackEntrySchema)

export function isArrayKey(key: string): boolean {
  return typeof key === 'string' && ARRAY_KEY_RE.test(key)
}

function hasUniqueIds(items: { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length
}

export function applyArrayChange(doc: Content, key: string, value: unknown): ApplyResult {
  const match = typeof key === 'string' ? ARRAY_KEY_RE.exec(key) : null
  if (!match) return { ok: false, reason: 'path' }

  const next = structuredClone(doc)
  if (match[1] === 'products') {
    const parsed = productsArraySchema.safeParse(value)
    if (!parsed.success || !hasUniqueIds(parsed.data)) return { ok: false, reason: 'invalid' }
    next.products = parsed.data
  } else {
    const trackIndex = Number(match[2])
    if (trackIndex >= doc.tracks.length) return { ok: false, reason: 'missing' }
    const parsed = entriesArraySchema.safeParse(value)
    if (!parsed.success || !hasUniqueIds(parsed.data)) return { ok: false, reason: 'invalid' }
    next.tracks[trackIndex].entries = parsed.data
  }

  const parsed = contentSchema.safeParse(next)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const unchanged = JSON.stringify(parsed.data) === JSON.stringify(doc)
  return { ok: true, doc: parsed.data, unchanged }
}

export class StaleWriteError extends Error {
  constructor() {
    super('content row changed since it was read')
    this.name = 'StaleWriteError'
  }
}

/**
 * Reads the live row (never the seed fallback: you cannot edit a document
 * that is not really there). Returns null when the row is missing, the
 * stored doc fails validation, or the database is unreachable.
 */
export async function loadCurrent(): Promise<{ doc: Content; updatedAt: string } | null> {
  try {
    const sql = getSql()
    const rows = await sql`select doc, updated_at::text as updated_at from content where id = 1`
    if (rows.length === 0) return null
    const parsed = contentSchema.safeParse(rows[0].doc)
    if (!parsed.success) return null
    return { doc: parsed.data, updatedAt: rows[0].updated_at as string }
  } catch (error) {
    // Fixed message plus error.name only: the neon driver embeds the full
    // connection string in some error messages.
    console.error('[editor] loadCurrent failed', error instanceof Error ? error.name : 'unknown error')
    return null
  }
}

/**
 * Single-statement optimistic write: snapshot the current doc into history
 * and replace it, both gated on updated_at still matching the value the
 * mutation was computed from. One statement means one snapshot: the
 * history copy and the overwrite can never disagree about "current".
 */
export async function persistContent(
  newDoc: Content,
  expectedUpdatedAt: string,
): Promise<{ updatedAt: string }> {
  const sql = getSql()
  const rows = await sql`
    with snap as (
      insert into content_history (doc)
      select doc from content where id = 1 and updated_at = ${expectedUpdatedAt}::timestamptz
      returning id
    )
    update content
       set doc = ${JSON.stringify(newDoc)}::jsonb, updated_at = now()
     where id = 1
       and updated_at = ${expectedUpdatedAt}::timestamptz
       and exists (select 1 from snap)
     returning updated_at::text as updated_at
  `
  if (rows.length === 0) throw new StaleWriteError()
  return { updatedAt: rows[0].updated_at as string }
}
