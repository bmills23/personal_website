import { describe, expect, it } from 'vitest'
import seed from '@/seed/content.json'
import { contentSchema, type Content } from '@/lib/content/schema'
import { applyFieldChange, applyArrayChange } from '@/lib/content/write'

const doc: Content = contentSchema.parse(seed)

describe('applyFieldChange', () => {
  it('rewrites an allowlisted leaf and returns a schema-valid doc', () => {
    const result = applyFieldChange(doc, 'about.heading', 'A new heading')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.doc.about.heading).toBe('A new heading')
      expect(result.unchanged).toBe(false)
      expect(() => contentSchema.parse(result.doc)).not.toThrow()
    }
  })
  it('never mutates the input document', () => {
    const before = JSON.stringify(doc)
    applyFieldChange(doc, 'about.heading', 'Mutation check')
    expect(JSON.stringify(doc)).toBe(before)
  })
  it('flags an identical value as unchanged', () => {
    const result = applyFieldChange(doc, 'about.heading', doc.about.heading)
    expect(result.ok && result.unchanged).toBe(true)
  })
  it('rejects a path outside the allowlist', () => {
    expect(applyFieldChange(doc, 'version', '2')).toEqual({ ok: false, reason: 'path' })
    expect(applyFieldChange(doc, 'products.0.id', 'x')).toEqual({ ok: false, reason: 'path' })
  })
  it('rejects an allowlisted pattern whose index does not exist in this doc', () => {
    // products cap is 6 but the seed has 2, so index 5 passes the allowlist
    // and must be caught by the existence check.
    expect(applyFieldChange(doc, 'products.5.name', 'ghost')).toEqual({ ok: false, reason: 'missing' })
  })
  it('rejects a leaf-only miss where the container itself still exists', () => {
    // about.paragraphs cap is 5, the seed has 3: 'about' and 'paragraphs'
    // both resolve fine (the container array exists), so this is caught
    // only by the leaf-existence check at the end of the walk, not by the
    // intermediate-segment loop, making that check independently
    // falsifiable rather than always shadowed by the loop's own check.
    expect(applyFieldChange(doc, 'about.paragraphs.4', 'x')).toEqual({ ok: false, reason: 'missing' })
  })
  it('rejects a value the whole-document schema refuses', () => {
    expect(applyFieldChange(doc, 'hero.name', '')).toEqual({ ok: false, reason: 'invalid' })
    expect(applyFieldChange(doc, 'hero.stamp', 'x'.repeat(21))).toEqual({ ok: false, reason: 'invalid' })
  })
  it('rejects javascript: URLs through the link url path', () => {
    expect(applyFieldChange(doc, 'footer.links.0.url', 'javascript:alert(1)')).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })
  it('rejects control characters and newlines', () => {
    expect(applyFieldChange(doc, 'about.heading', 'line\nbreak')).toEqual({ ok: false, reason: 'invalid' })
    expect(applyFieldChange(doc, 'about.heading', 'nul\u0000byte')).toEqual({ ok: false, reason: 'invalid' })
  })
})

describe('applyArrayChange', () => {
  it('replaces the products array wholesale', () => {
    const next = [...doc.products].reverse()
    const result = applyArrayChange(doc, 'products', next)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.doc.products[0].id).toBe(doc.products[1].id)
  })
  it('replaces one track entries array', () => {
    const entries = [...doc.tracks[0].entries]
    const result = applyArrayChange(doc, 'tracks.0.entries', entries)
    expect(result.ok).toBe(true)
  })
  it('rejects unknown keys, including attempts at other arrays', () => {
    expect(applyArrayChange(doc, 'tracks', []).ok).toBe(false)
    expect(applyArrayChange(doc, 'footer.links', []).ok).toBe(false)
    expect(applyArrayChange(doc, '__proto__', []).ok).toBe(false)
  })
  it('rejects a tracks index that does not exist', () => {
    expect(applyArrayChange(doc, 'tracks.2.entries', [])).toEqual({ ok: false, reason: 'missing' })
  })
  it('rejects arrays over the schema cap', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...doc.products[0], id: `p${i}` }))
    expect(applyArrayChange(doc, 'products', many)).toEqual({ ok: false, reason: 'invalid' })
  })
  it('rejects duplicate ids within the array', () => {
    const dupes = [doc.products[0], { ...doc.products[1], id: doc.products[0].id }]
    expect(applyArrayChange(doc, 'products', dupes)).toEqual({ ok: false, reason: 'invalid' })
  })
  it('rejects structurally invalid members', () => {
    expect(applyArrayChange(doc, 'products', [{ id: 'x' }])).toEqual({ ok: false, reason: 'invalid' })
  })
  it('rejects control characters buried inside an array-path payload', () => {
    const withEscapeCode = doc.products.map((product, i) =>
      i === 0 ? { ...product, name: 'Foo\u001B[2J' } : product,
    )
    expect(applyArrayChange(doc, 'products', withEscapeCode)).toEqual({ ok: false, reason: 'invalid' })

    const withCrlf = doc.tracks[0].entries.map((entry, i) =>
      i === 0 ? { ...entry, body: 'x\r\ny' } : entry,
    )
    expect(applyArrayChange(doc, 'tracks.0.entries', withCrlf)).toEqual({ ok: false, reason: 'invalid' })
  })
})
