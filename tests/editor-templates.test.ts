import { describe, expect, it } from 'vitest'
import seed from '@/seed/content.json'
import { contentSchema, productSchema, trackEntrySchema } from '@/lib/content/schema'
import { applyArrayChange } from '@/lib/content/write'
import { newProduct, newTrackEntry, uniqueId } from '@/lib/editor/templates'

const doc = contentSchema.parse(seed)

describe('newProduct / newTrackEntry', () => {
  it('newProduct([]) passes productSchema', () => {
    expect(() => productSchema.parse(newProduct([]))).not.toThrow()
  })

  it('newTrackEntry([]) passes trackEntrySchema', () => {
    expect(() => trackEntrySchema.parse(newTrackEntry([]))).not.toThrow()
  })
})

describe('uniqueId', () => {
  it('returns the first free n, no randomness or Date involved', () => {
    expect(uniqueId('product', ['product-1', 'product-2'])).toBe('product-3')
    expect(uniqueId('x', [])).toBe('x-1')
  })

  it('skips only the exact taken slots, not a contiguous-run assumption', () => {
    expect(uniqueId('product', ['product-1', 'product-3'])).toBe('product-2')
  })
})

describe('template + applyArrayChange integration', () => {
  it('appending newProduct to the seed keeps the whole doc schema-valid', () => {
    const existingIds = doc.products.map((p) => p.id)
    const next = [...doc.products, newProduct(existingIds)]
    const result = applyArrayChange(doc, 'products', next)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.doc.products).toHaveLength(doc.products.length + 1)
  })

  it('appending newTrackEntry to a track keeps the whole doc schema-valid', () => {
    const existingIds = doc.tracks[0].entries.map((e) => e.id)
    const next = [...doc.tracks[0].entries, newTrackEntry(existingIds)]
    const result = applyArrayChange(doc, 'tracks.0.entries', next)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.doc.tracks[0].entries).toHaveLength(doc.tracks[0].entries.length + 1)
  })
})
