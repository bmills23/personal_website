/**
 * Content-based React keys for an array of items that have no stable `id`
 * field of their own (product tags are plain strings; product/footer links
 * are `{ label, url }` objects with nothing pinning one to a particular
 * array slot). An index key (`key={j}`) is what caused the stale-slot bug
 * this exists to close: removing/reordering an earlier item shifts a later
 * item's index, and an index-keyed React element at that position is
 * reused in place rather than treated as a different logical item, so a
 * component with any per-mount state (EditableField's frozen text
 * snapshot, see Editable.tsx) can end up displaying the wrong item's stale
 * value while `path` (computed from the same index) now points at
 * whatever actually shifted into that slot - a silent wrong-slot write.
 *
 * Keying on content instead means a slot's identity follows ITS OWN value
 * as the array is edited: an untouched item keeps the same key (and so the
 * same component instance/state) even when its index moves, while a
 * removed item's key simply disappears rather than being silently
 * reinterpreted as whatever moved into its old position.
 *
 * `toKey` must fold each item down to a string that captures everything
 * that makes two items meaningfully different (for a link, both label AND
 * url - two links can share a label with different destinations, or vice
 * versa; combine multi-field items with `JSON.stringify([a, b])` rather
 * than plain string concatenation, since concatenation can make two
 * genuinely different items collide, e.g. label "A" + url "BC" vs label
 * "AB" + url "C"). Disambiguated by occurrence order (a running per-value
 * counter) so two items whose `toKey` output is identical - e.g. two tags
 * both literally "AI" - still get distinct keys within one render, which
 * plain content keying alone would collide on (React would warn and only
 * one of the two would actually render).
 */
export function contentKeys<T>(items: readonly T[], toKey: (item: T) => string): string[] {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const base = toKey(item)
    const occurrence = seen.get(base) ?? 0
    seen.set(base, occurrence + 1)
    // JSON.stringify (not string concatenation) so pairing `base` with its
    // occurrence number here can never itself collide across two distinct
    // `base` values.
    return JSON.stringify([base, occurrence])
  })
}
