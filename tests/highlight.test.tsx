import { describe, it, expect } from 'vitest'
import { splitHighlights } from '@/lib/highlight'

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
})
