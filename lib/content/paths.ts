/**
 * Editable path patterns. '#' matches a single non-negative integer index.
 * Only string leaves appear here. Structural edits (adding or removing a
 * product, reordering entries) are separate operations, not path writes.
 */
export const EDITABLE_PATTERNS = [
  'hero.kicker',
  'hero.name',
  'hero.lede',
  'hero.stamp',
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
] as const

/** Upper bound on any array index, matching the schema's generous max array sizes. */
const MAX_INDEX = 20

const INDEX_RE = /^(0|[1-9][0-9]?)$/

function isIndex(segment: string): boolean {
  return INDEX_RE.test(segment) && Number(segment) <= MAX_INDEX
}

export function isEditablePath(path: string): boolean {
  if (typeof path !== 'string' || path.length === 0 || path.length > 120) return false
  // Reject anything that is not plain lowercase-ish identifiers, digits, and dots.
  if (!/^[A-Za-z0-9.]+$/.test(path)) return false
  if (path.startsWith('.') || path.endsWith('.') || path.includes('..')) return false

  const segments = path.split('.')
  if (segments.some((s) => s === '__proto__' || s === 'constructor' || s === 'prototype')) {
    return false
  }

  return EDITABLE_PATTERNS.some((pattern) => {
    const parts = pattern.split('.')
    if (parts.length !== segments.length) return false
    return parts.every((part, i) => (part === '#' ? isIndex(segments[i]) : part === segments[i]))
  })
}

/** Concrete paths for a given document, used by the UI to know what is editable. */
export const EDITABLE_PATHS: readonly string[] = EDITABLE_PATTERNS
