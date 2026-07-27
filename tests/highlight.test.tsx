import { describe, it, expect } from 'vitest'
import { splitHighlights } from '@/lib/highlight'
import seed from '@/seed/content.json'

describe('splitHighlights', () => {
  it('returns the whole string unmarked when there are no phrases', () => {
    expect(splitHighlights('hello world', [])).toEqual([{ text: 'hello world', mark: false }])
  })

  it('marks a single phrase', () => {
    expect(splitHighlights('I build Parolejo daily', ['Parolejo'])).toEqual([
      { text: 'I build ', mark: false },
      { text: 'Parolejo', mark: true },
      { text: ' daily', mark: false },
    ])
  })

  it('marks the longest phrase first when phrases overlap', () => {
    // "TerminaLLM LLC" and "TerminaLLM" both match at index 0. The longer one wins,
    // otherwise "TerminaLLM" would consume the prefix and orphan " LLC".
    const result = splitHighlights('Founder of TerminaLLM LLC today', ['TerminaLLM', 'TerminaLLM LLC'])
    expect(result).toEqual([
      { text: 'Founder of ', mark: false },
      { text: 'TerminaLLM LLC', mark: true },
      { text: ' today', mark: false },
    ])
  })

  it('marks every occurrence of a phrase', () => {
    const result = splitHighlights('a X b X c', ['X'])
    expect(result.filter((s) => s.mark).length).toBe(2)
  })

  it('ignores a phrase that is not present', () => {
    expect(splitHighlights('hello', ['absent'])).toEqual([{ text: 'hello', mark: false }])
  })

  it('is case sensitive, so it never marks the wrong word', () => {
    expect(splitHighlights('the terminallm app', ['TerminaLLM'])).toEqual([
      { text: 'the terminallm app', mark: false },
    ])
  })

  it('never loses or duplicates text', () => {
    const text = 'Founder of TerminaLLM LLC, building TerminaLLM and Parolejo.'
    const phrases = ['TerminaLLM LLC', 'TerminaLLM', 'Parolejo']
    expect(splitHighlights(text, phrases).map((s) => s.text).join('')).toBe(text)
  })

  it('ignores empty phrases rather than looping forever', () => {
    expect(splitHighlights('hello', [''])).toEqual([{ text: 'hello', mark: false }])
  })

  // The tests above only exercise synthetic strings. Nothing else ties the
  // splitter to the real content document, so a future edit to hero.lede or
  // hero.highlights (e.g. typing a plain space where the lede currently has
  // a non-breaking space between "TerminaLLM" and "LLC") could silently stop
  // a phrase from matching while every other test here stays green. This
  // test runs the splitter over the actual seed document so that kind of
  // drift fails loudly and names the phrase that broke.
  it('marks all three configured phrases in the real seed lede', () => {
    const result = splitHighlights(seed.hero.lede, seed.hero.highlights)
    const marked = result.filter((s) => s.mark).map((s) => s.text)

    expect(marked).toHaveLength(3)
    // Sorted so this asserts the set of matched phrases, not the incidental
    // order they happen to appear in the lede; a missing phrase still shows
    // up by name in the diff.
    expect([...marked].sort()).toEqual([...seed.hero.highlights].sort())
    expect(result.map((s) => s.text).join('')).toBe(seed.hero.lede)
  })
})
