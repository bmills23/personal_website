'use server'

import { z } from 'zod'
import { updateTag } from 'next/cache'
import { requireAdminSession } from '@/lib/auth'
import {
  applyArrayChange,
  applyFieldChange,
  isArrayKey,
  loadCurrent,
  persistContent,
  StaleWriteError,
  type ApplyResult,
} from '@/lib/content/write'
import { isEditablePath } from '@/lib/content/paths'
import { contentSchema, type Content } from '@/lib/content/schema'
import { getSql } from '@/lib/db'

export type SaveResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: 'unauthorized' | 'invalid' | 'stale' | 'nothing-to-revert' | 'server' }

// Generous pre-gates; the whole-document schema is the real bound.
const fieldInput = z.object({
  path: z.string().min(1).max(120),
  value: z.string().max(2000),
  updatedAt: z.string().min(1).max(64),
})
const arrayInput = z.object({
  key: z.string().min(1).max(40),
  value: z.unknown(),
  updatedAt: z.string().min(1).max(64),
})
const revertInput = z.object({ updatedAt: z.string().min(1).max(64) })

async function commit(
  mutate: (doc: Content) => ApplyResult,
  clientToken: string,
): Promise<SaveResult> {
  const current = await loadCurrent()
  if (!current) return { ok: false, error: 'server' }
  // Client staleness: the edit was made against an older document.
  if (current.updatedAt !== clientToken) return { ok: false, error: 'stale' }

  const applied = mutate(current.doc)
  // 'path', 'missing', and 'invalid' are all client-fixable rejections; the
  // distinction matters for tests, not for the toolbar message.
  if (!applied.ok) return { ok: false, error: 'invalid' }
  if (applied.unchanged) return { ok: true, updatedAt: current.updatedAt }

  try {
    // The WHERE inside persistContent uses current.updatedAt (the token of
    // the doc the mutation was computed from), which closes the race
    // between our read and our write.
    const { updatedAt } = await persistContent(applied.doc, current.updatedAt)
    updateTag('content')
    return { ok: true, updatedAt }
  } catch (error) {
    if (error instanceof StaleWriteError) return { ok: false, error: 'stale' }
    console.error('[editor] save failed', error instanceof Error ? error.name : 'unknown error')
    return { ok: false, error: 'server' }
  }
}

export async function saveField(input: {
  path: string
  value: string
  updatedAt: string
}): Promise<SaveResult> {
  const admin = await requireAdminSession()
  if (!admin.ok) return { ok: false, error: 'unauthorized' }
  const parsed = fieldInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }
  const { path, value, updatedAt } = parsed.data
  // An obviously bad path must not cost a database read.
  if (!isEditablePath(path)) return { ok: false, error: 'invalid' }
  return commit((doc) => applyFieldChange(doc, path, value), updatedAt)
}

export async function saveArray(input: {
  key: string
  value: unknown
  updatedAt: string
}): Promise<SaveResult> {
  const admin = await requireAdminSession()
  if (!admin.ok) return { ok: false, error: 'unauthorized' }
  const parsed = arrayInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }
  const { key, value, updatedAt } = parsed.data
  // An obviously bad key must not cost a database read.
  if (!isArrayKey(key)) return { ok: false, error: 'invalid' }
  return commit((doc) => applyArrayChange(doc, key, value), updatedAt)
}

export async function revertLastSave(input: { updatedAt: string }): Promise<SaveResult> {
  const admin = await requireAdminSession()
  if (!admin.ok) return { ok: false, error: 'unauthorized' }
  const parsed = revertInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const current = await loadCurrent()
  if (!current) return { ok: false, error: 'server' }
  if (current.updatedAt !== parsed.data.updatedAt) return { ok: false, error: 'stale' }

  try {
    const sql = getSql()
    const historyRows = await sql`select id, doc from content_history order by id desc limit 1`
    if (historyRows.length === 0) return { ok: false, error: 'nothing-to-revert' }
    const restored = contentSchema.safeParse(historyRows[0].doc)
    if (!restored.success) return { ok: false, error: 'server' }
    const historyId = historyRows[0].id as number

    // Snapshot current, consume the restored history row, and swap the doc
    // in one statement so a race cannot leave history half-applied. Revert
    // twice returns to where you started; nothing is ever lost.
    const rows = await sql`
      with snap as (
        insert into content_history (doc)
        select doc from content where id = 1 and updated_at = ${current.updatedAt}::timestamptz
        returning id
      ), consumed as (
        delete from content_history
         where id = ${historyId} and exists (select 1 from snap)
        returning id
      )
      update content
         set doc = ${JSON.stringify(restored.data)}::jsonb, updated_at = now()
       where id = 1
         and updated_at = ${current.updatedAt}::timestamptz
         and exists (select 1 from consumed)
       returning updated_at::text as updated_at
    `
    if (rows.length === 0) return { ok: false, error: 'stale' }
    updateTag('content')
    return { ok: true, updatedAt: rows[0].updated_at as string }
  } catch (error) {
    console.error('[editor] revert failed', error instanceof Error ? error.name : 'unknown error')
    return { ok: false, error: 'server' }
  }
}

export async function getEditorState(): Promise<{ ok: true; updatedAt: string } | { ok: false }> {
  const admin = await requireAdminSession()
  if (!admin.ok) return { ok: false }
  const current = await loadCurrent()
  if (!current) return { ok: false }
  return { ok: true, updatedAt: current.updatedAt }
}
