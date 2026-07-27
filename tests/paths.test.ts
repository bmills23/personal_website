import { describe, it, expect } from 'vitest'
import { isEditablePath, EDITABLE_PATTERNS } from '@/lib/content/paths'

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

describe('isEditablePath: index bound is the real schema max, not a global guess', () => {
  it.each([
    'products.5.name',
    'tracks.2.label',
    'about.paragraphs.4',
    'products.0.tags.7',
    'products.0.links.3.url',
    'footer.links.5.url',
    'tracks.0.entries.9.role',
  ])('allows %s (last valid index)', (path) => {
    expect(isEditablePath(path)).toBe(true)
  })

  it.each([
    'products.6.name',
    'tracks.3.label',
    'about.paragraphs.5',
    'products.0.tags.8',
    'products.0.links.4.url',
    'footer.links.6.url',
    'tracks.0.entries.10.role',
  ])('rejects %s (first index past the schema max)', (path) => {
    expect(isEditablePath(path)).toBe(false)
  })
})

describe('isEditablePath: container prefixes are not editable', () => {
  it.each([
    'products.0',
    'products.0.links',
    'products.0.links.0',
    'products.0.tags',
    'about.paragraphs',
    'tracks.0.entries.0',
  ])('rejects %s', (path) => {
    expect(isEditablePath(path)).toBe(false)
  })
})

describe('isEditablePath: structural ids stay non-editable', () => {
  it.each(['products.0.id', 'tracks.0.entries.0.id'])('rejects %s', (path) => {
    expect(isEditablePath(path)).toBe(false)
  })
})

describe('isEditablePath: length cap', () => {
  it('rejects a path longer than 120 characters', () => {
    expect(isEditablePath('a'.repeat(130))).toBe(false)
  })
})

describe('isEditablePath: unicode digits are not accepted as indices', () => {
  it.each([
    ['Arabic-indic digit', 'products.٣.name'],
    ['fullwidth digit', 'products.１.name'],
  ])('rejects %s', (_label, path) => {
    expect(isEditablePath(path)).toBe(false)
  })
})

describe('EDITABLE_PATTERNS', () => {
  it('is non-empty', () => {
    expect(EDITABLE_PATTERNS.length).toBeGreaterThan(10)
  })
  it('contains no duplicates', () => {
    expect(new Set(EDITABLE_PATTERNS).size).toBe(EDITABLE_PATTERNS.length)
  })
})
