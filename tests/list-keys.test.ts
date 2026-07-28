import { describe, expect, it } from 'vitest'
import { contentKeys } from '@/lib/editor/listKeys'

describe('contentKeys', () => {
  it('returns one key per item, in order', () => {
    expect(contentKeys(['A', 'B', 'C'], (x) => x)).toHaveLength(3)
  })

  it('gives every item a unique key even when text repeats', () => {
    const keys = contentKeys(['AI', 'AI', 'ML'], (x) => x)
    expect(new Set(keys).size).toBe(3)
  })

  it('an untouched item keeps the same key across a removal elsewhere in the array', () => {
    const before = contentKeys(['A', 'B', 'C'], (x) => x)
    const after = contentKeys(['A', 'C'], (x) => x)
    // "C" is untouched by removing "B"; its key must not depend on its
    // index (index 2 before, index 1 after), only on its own content and
    // occurrence order, so a removal elsewhere never remounts it.
    expect(after[1]).toBe(before[2])
  })

  it('a removed item is simply absent, not silently reassigned to whatever shifted into its slot', () => {
    const before = contentKeys(['A', 'B', 'C'], (x) => x)
    const after = contentKeys(['A', 'C'], (x) => x)
    expect(after).not.toContain(before[1]) // "B"'s key
  })

  it('objects combined via JSON.stringify cannot collide across differing fields', () => {
    const links = [
      { label: 'A', url: 'BC' },
      { label: 'AB', url: 'C' },
    ]
    const keys = contentKeys(links, (l) => JSON.stringify([l.label, l.url]))
    expect(new Set(keys).size).toBe(2)
  })
})
