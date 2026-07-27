export type Segment = { text: string; mark: boolean }

/**
 * Splits text into marked and unmarked segments. Phrases are matched longest
 * first, which only matters for phrases that share a start index: for a pair
 * like "TerminaLLM LLC" and "TerminaLLM" both starting at the same position,
 * the longer one wins rather than the scan consuming "TerminaLLM" and
 * orphaning " LLC". The scan itself is left-to-right and greedy, so for
 * phrases overlapping at different start positions, whichever position is
 * reached first wins regardless of phrase length. Matching is exact and case
 * sensitive: a phrase that no longer appears simply stops highlighting, which is
 * the correct failure for editable text.
 */
export function splitHighlights(text: string, phrases: readonly string[]): Segment[] {
  const wanted = [...new Set(phrases)].filter((p) => p.length > 0).sort((a, b) => b.length - a.length)
  if (wanted.length === 0) return [{ text, mark: false }]

  const segments: Segment[] = []
  let buffer = ''
  let i = 0

  while (i < text.length) {
    const hit = wanted.find((p) => text.startsWith(p, i))
    if (hit) {
      if (buffer) {
        segments.push({ text: buffer, mark: false })
        buffer = ''
      }
      segments.push({ text: hit, mark: true })
      i += hit.length
    } else {
      buffer += text[i]
      i += 1
    }
  }
  if (buffer) segments.push({ text: buffer, mark: false })
  return segments.length > 0 ? segments : [{ text, mark: false }]
}
