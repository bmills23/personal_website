import { ARRAY_LIMITS } from './schema'

/**
 * Editable path patterns. '#' matches a single non-negative integer index.
 * Only string leaves appear here. Structural edits (adding or removing a
 * product, reordering entries) are separate operations, not path writes.
 *
 * These are patterns, not concrete document paths: a '#' segment is a
 * placeholder, not a literal value. Expanding a pattern against a real
 * document (to get e.g. every current `products.N.name`) is a UI concern
 * for the editor built in a later phase, and is out of scope here.
 */
export const EDITABLE_PATTERNS = [
  'hero.kicker',
  'hero.name',
  'hero.lede',
  'hero.stamp',
  'hero.highlights.#',
  'about.heading',
  'about.marginNote',
  'about.paragraphs.#',
  'products.#.name',
  'products.#.tagline',
  'products.#.body',
  'products.#.tags.#',
  'products.#.links.#.label',
  'products.#.links.#.url',
  'tracks.#.label',
  'tracks.#.entries.#.org',
  'tracks.#.entries.#.role',
  'tracks.#.entries.#.period',
  'tracks.#.entries.#.body',
  'contact.heading',
  'contact.blurb',
  'footer.note',
  'footer.links.#.label',
  'footer.links.#.url',
  'sections.products.kicker',
  'sections.work.kicker',
] as const

const INDEX_RE = /^(0|[1-9][0-9]?)$/

function isIndex(segment: string, maxLength: number): boolean {
  // maxLength is the array's max *length* (from the schema); the highest
  // valid index into such an array is maxLength - 1.
  return INDEX_RE.test(segment) && Number(segment) <= maxLength - 1
}

/**
 * For a pattern's '#' segment at position `hashIndex`, find the dotted key
 * (matching ARRAY_LIMITS) that names the array that slot indexes. This is
 * every non-'#' segment before it, joined with dots: e.g. for
 * 'products.#.tags.#' the second '#' resolves to 'products.tags'.
 */
function arrayKeyFor(patternParts: readonly string[], hashIndex: number): string {
  return patternParts
    .slice(0, hashIndex)
    .filter((part) => part !== '#')
    .join('.')
}

/** Per pattern, the max array length for each '#' slot it contains, in order. */
const PATTERN_INDEX_CAPS: readonly (readonly number[])[] = EDITABLE_PATTERNS.map((pattern) => {
  const parts = pattern.split('.')
  return parts.reduce<number[]>((caps, part, i) => {
    if (part !== '#') return caps
    const key = arrayKeyFor(parts, i)
    const limit = (ARRAY_LIMITS as Record<string, number>)[key]
    if (limit === undefined) {
      throw new Error(`isEditablePath: no ARRAY_LIMITS entry for "${key}" (pattern "${pattern}")`)
    }
    caps.push(limit)
    return caps
  }, [])
})

export function isEditablePath(path: string): boolean {
  if (typeof path !== 'string' || path.length === 0 || path.length > 120) return false
  // Reject anything that is not plain lowercase-ish identifiers, digits, and dots.
  if (!/^[A-Za-z0-9.]+$/.test(path)) return false
  if (path.startsWith('.') || path.endsWith('.') || path.includes('..')) return false

  const segments = path.split('.')
  if (segments.some((s) => s === '__proto__' || s === 'constructor' || s === 'prototype')) {
    return false
  }

  return EDITABLE_PATTERNS.some((pattern, patternIndex) => {
    const parts = pattern.split('.')
    if (parts.length !== segments.length) return false
    const caps = PATTERN_INDEX_CAPS[patternIndex]
    let hashesSeen = 0
    return parts.every((part, i) => {
      if (part !== '#') return part === segments[i]
      const cap = caps[hashesSeen]
      hashesSeen += 1
      return isIndex(segments[i], cap)
    })
  })
}
