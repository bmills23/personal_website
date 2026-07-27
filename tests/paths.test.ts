import { describe, it, expect } from 'vitest'
import { isEditablePath, EDITABLE_PATHS } from '@/lib/content/paths'

describe('isEditablePath: allows real fields', () => {
  it.each([
    'hero.name',
    'hero.lede',
    'hero.kicker',
    'hero.stamp',
    'about.heading',
    'about.marginNote',
    'about.paragraphs.0',
    'about.paragraphs.2',
    'products.0.name',
    'products.1.body',
    'products.0.tags.3',
    'products.0.links.0.url',
    'tracks.0.entries.0.role',
    'contact.blurb',
    'footer.links.1.label',
  ])('allows %s', (path) => {
    expect(isEditablePath(path)).toBe(true)
  })
})

describe('isEditablePath: rejects everything else', () => {
  it.each([
    ['unknown top-level key', 'admin.isAdmin'],
    ['unknown leaf', 'hero.password'],
    ['the version field', 'version'],
    ['a whole object', 'hero'],
    ['a whole array', 'products'],
    ['prototype pollution', '__proto__.polluted'],
    ['constructor', 'constructor.prototype.x'],
    ['prototype segment mid-path', 'hero.__proto__.x'],
    ['negative index', 'products.-1.name'],
    ['non-numeric index', 'products.abc.name'],
    ['float index', 'products.1.5.name'],
    ['index beyond the schema max', 'products.99.name'],
    ['empty string', ''],
    ['trailing dot', 'hero.name.'],
    ['leading dot', '.hero.name'],
    ['double dot', 'hero..name'],
    ['whitespace', 'hero.name '],
    ['sql-ish', "hero.name'; drop table content;--"],
    ['path traversal', '../../etc/passwd'],
    ['deeply nested nonsense', 'a.b.c.d.e.f.g'],
  ])('rejects %s', (_label, path) => {
    expect(isEditablePath(path)).toBe(false)
  })
})

describe('EDITABLE_PATHS', () => {
  it('is non-empty', () => {
    expect(EDITABLE_PATHS.length).toBeGreaterThan(10)
  })
  it('contains no duplicates', () => {
    expect(new Set(EDITABLE_PATHS).size).toBe(EDITABLE_PATHS.length)
  })
})
