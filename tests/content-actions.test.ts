import { beforeEach, describe, expect, it, vi } from 'vitest'
import seed from '@/seed/content.json'
import { contentSchema } from '@/lib/content/schema'

const requireAdminSession = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAdminSession: () => requireAdminSession() }))

const updateTag = vi.fn()
vi.mock('next/cache', () => ({ updateTag: (tag: string) => updateTag(tag) }))

const sqlCalls: string[] = []
let sqlResults: unknown[][] = []
vi.mock('@/lib/db', () => ({
  getSql: () => {
    return (strings: TemplateStringsArray, ..._values: unknown[]) => {
      sqlCalls.push(strings.join('$'))
      return Promise.resolve(sqlResults.shift() ?? [])
    }
  },
}))

const doc = contentSchema.parse(seed)
const TOKEN = '2026-07-28 08:00:00.000+00'

function primeLoad() {
  sqlResults.push([{ doc, updated_at: TOKEN }])
}

beforeEach(() => {
  vi.clearAllMocks()
  sqlCalls.length = 0
  sqlResults = []
})

describe('saveField', () => {
  it('rejects before touching the database when there is no admin session', async () => {
    requireAdminSession.mockResolvedValue({ ok: false })
    const { saveField } = await import('@/app/actions/content')
    const result = await saveField({ path: 'about.heading', value: 'X', updatedAt: TOKEN })
    expect(result).toEqual({ ok: false, error: 'unauthorized' })
    expect(sqlCalls).toHaveLength(0)
    expect(updateTag).not.toHaveBeenCalled()
  })
  it('rejects a bad path before touching the database', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    const { saveField } = await import('@/app/actions/content')
    const result = await saveField({ path: 'version', value: '2', updatedAt: TOKEN })
    expect(result).toEqual({ ok: false, error: 'invalid' })
    expect(sqlCalls).toHaveLength(0)
  })
  it('writes, snapshots history, and invalidates the content tag', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    sqlResults.push([{ updated_at: '2026-07-28 08:00:01.000+00' }])
    const { saveField } = await import('@/app/actions/content')
    const result = await saveField({ path: 'about.heading', value: 'Fresh heading', updatedAt: TOKEN })
    expect(result).toEqual({ ok: true, updatedAt: '2026-07-28 08:00:01.000+00' })
    expect(sqlCalls[1]).toContain('content_history')
    expect(sqlCalls[1]).toContain('update content')
    expect(updateTag).toHaveBeenCalledWith('content')
  })
  it('reports stale when the client token does not match the stored row', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    // Prime a write result that WOULD succeed if the guard let the write through. If the
    // client-token check is falsely removed, the action would proceed to this primed write
    // and return ok:true with two sql calls; priming it here is what makes this test able to
    // fail, rather than passing vacuously because there is nothing queued for a write.
    sqlResults.push([{ updated_at: '2026-07-28 09:00:00.000+00' }])
    const { saveField } = await import('@/app/actions/content')
    const result = await saveField({ path: 'about.heading', value: 'X', updatedAt: 'some-older-token' })
    expect(result).toEqual({ ok: false, error: 'stale' })
    // The guarded early return means the write must never be attempted: only the read happens.
    expect(sqlCalls).toHaveLength(1)
    expect(updateTag).not.toHaveBeenCalled()
  })
  it('reports stale when the guarded write affects zero rows', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    sqlResults.push([]) // the CTE write returns no rows: lost the race
    const { saveField } = await import('@/app/actions/content')
    const result = await saveField({ path: 'about.heading', value: 'X', updatedAt: TOKEN })
    expect(result).toEqual({ ok: false, error: 'stale' })
    expect(updateTag).not.toHaveBeenCalled()
  })
  it('returns ok without writing when the value is unchanged', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    const { saveField } = await import('@/app/actions/content')
    const result = await saveField({ path: 'about.heading', value: doc.about.heading, updatedAt: TOKEN })
    expect(result).toEqual({ ok: true, updatedAt: TOKEN })
    expect(sqlCalls).toHaveLength(1) // the read, no write
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('saveArray', () => {
  it('rejects an unknown array key before touching the database', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    const { saveArray } = await import('@/app/actions/content')
    const result = await saveArray({ key: 'footer.links', value: [], updatedAt: TOKEN })
    expect(result).toEqual({ ok: false, error: 'invalid' })
    expect(sqlCalls).toHaveLength(0)
  })
  it('rejects without an admin session before touching the database', async () => {
    requireAdminSession.mockResolvedValue({ ok: false })
    const { saveArray } = await import('@/app/actions/content')
    const result = await saveArray({ key: 'products', value: [], updatedAt: TOKEN })
    expect(result).toEqual({ ok: false, error: 'unauthorized' })
    expect(sqlCalls).toHaveLength(0)
  })
  it('writes a valid reordered products array and invalidates the content tag', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    sqlResults.push([{ updated_at: '2026-07-28 08:00:03.000+00' }])
    const { saveArray } = await import('@/app/actions/content')
    const reordered = [...doc.products].reverse()
    const result = await saveArray({ key: 'products', value: reordered, updatedAt: TOKEN })
    expect(result).toEqual({ ok: true, updatedAt: '2026-07-28 08:00:03.000+00' })
    expect(updateTag).toHaveBeenCalledWith('content')
  })
})

describe('getEditorState', () => {
  it('refuses without an admin session', async () => {
    requireAdminSession.mockResolvedValue({ ok: false })
    const { getEditorState } = await import('@/app/actions/content')
    expect(await getEditorState()).toEqual({ ok: false })
    expect(sqlCalls).toHaveLength(0)
  })
  it('returns the opaque token for the admin', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    const { getEditorState } = await import('@/app/actions/content')
    expect(await getEditorState()).toEqual({ ok: true, updatedAt: TOKEN })
  })
})

describe('revertLastSave', () => {
  it('reports nothing-to-revert on an empty history', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    sqlResults.push([]) // history query: empty
    const { revertLastSave } = await import('@/app/actions/content')
    expect(await revertLastSave({ updatedAt: TOKEN })).toEqual({ ok: false, error: 'nothing-to-revert' })
  })
  it('restores the newest history doc and invalidates the tag', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    const olderDoc = structuredClone(doc)
    olderDoc.about.heading = 'The older heading'
    sqlResults.push([{ id: 7, doc: olderDoc }])
    sqlResults.push([{ updated_at: '2026-07-28 08:00:02.000+00' }])
    const { revertLastSave } = await import('@/app/actions/content')
    const result = await revertLastSave({ updatedAt: TOKEN })
    expect(result).toEqual({ ok: true, updatedAt: '2026-07-28 08:00:02.000+00' })
    expect(updateTag).toHaveBeenCalledWith('content')
  })
  it('refuses to restore a history doc that fails the schema', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    sqlResults.push([{ id: 7, doc: { garbage: true } }])
    const { revertLastSave } = await import('@/app/actions/content')
    expect(await revertLastSave({ updatedAt: TOKEN })).toEqual({ ok: false, error: 'server' })
    expect(updateTag).not.toHaveBeenCalled()
  })
})
