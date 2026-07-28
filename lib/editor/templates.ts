import type { Content } from '@/lib/content/schema'

/**
 * First `${prefix}-${n}` (n starting at 1) not already present in `taken`.
 * Deterministic on purpose (no `Date.now`, no randomness): the same
 * fixture must always produce the same id in tests, and two rapid "add"
 * clicks in one session - before a `router.refresh()` reloads server
 * state with real ids - each need a distinct, predictable id computed
 * purely from the ids already visible on the page.
 */
export function uniqueId(prefix: string, taken: string[]): string {
  const takenSet = new Set(taken)
  let n = 1
  while (takenSet.has(`${prefix}-${n}`)) n += 1
  return `${prefix}-${n}`
}

/** A fresh product row, ready to append to `Content['products']`. */
export function newProduct(existingIds: string[]): Content['products'][number] {
  return {
    id: uniqueId('product', existingIds),
    name: 'New product',
    tagline: 'What it promises',
    body: 'What it is and why it matters.',
    tags: [],
    links: [],
  }
}

/** A fresh work-track entry, ready to append to one track's `entries`. */
export function newTrackEntry(
  existingIds: string[],
): Content['tracks'][number]['entries'][number] {
  return {
    id: uniqueId('entry', existingIds),
    org: 'Organization',
    role: 'Role',
    period: 'Present',
    body: '',
  }
}
