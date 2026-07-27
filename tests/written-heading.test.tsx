// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WrittenHeading } from '@/components/shell/WrittenHeading'

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
})

describe('WrittenHeading', () => {
  it('renders its text even when the animation never runs', () => {
    render(<WrittenHeading>Two careers, one set of tools</WrittenHeading>)
    expect(screen.getByText('Two careers, one set of tools')).toBeTruthy()
  })

  it('renders the requested heading level', () => {
    render(<WrittenHeading as="h1">Bryan G. Mills</WrittenHeading>)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bryan G. Mills')
  })

  it('marks the underline decorative', () => {
    const { container } = render(<WrittenHeading>Work</WrittenHeading>)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('omits the underline when asked', () => {
    const { container } = render(<WrittenHeading underline={false}>Work</WrittenHeading>)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('starts unwritten so the animation has somewhere to go', () => {
    const { container } = render(<WrittenHeading>Work</WrittenHeading>)
    expect(container.querySelector('[data-write]')?.getAttribute('data-written')).toBeNull()
  })

  // The five tests above render into jsdom with IntersectionObserver stubbed
  // as a no-op, so `written` never flips true. jsdom builds the DOM
  // regardless of CSS and none of those tests assert visibility, so they
  // would keep passing even if this component regressed to the forbidden
  // `motion.h2` pattern with `initial={{ clipPath: 'inset(0 100% 0 0)' }}`:
  // the text node would still exist, just styled invisible. This test
  // closes that gap the way jsdom actually can: by asserting the component
  // itself carries no inline clip-path. Verified against the real
  // regression: rendering a throwaway `motion.h2` with that initial prop
  // produces `<h2 style="clip-path: inset(0 100% 0 0);">` in jsdom (motion
  // applies `initial` synchronously during the first render, before any
  // animation frame), so this assertion does fail against that pattern, not
  // just against a hypothetical.
  it('carries no inline clip-path, so hiding is CSS-owned rather than baked into the render', () => {
    const { container } = render(<WrittenHeading>Work</WrittenHeading>)
    const heading = container.querySelector<HTMLElement>('h1, h2, h3')
    const ink = container.querySelector<HTMLElement>('.write-ink')
    expect(heading?.style.clipPath).toBe('')
    expect(ink?.style.clipPath).toBe('')
  })
})

// The component-side test above only proves WrittenHeading itself renders no
// inline clip. It says nothing about whether the CSS that is supposed to own
// the hiding still exists and is still correctly gated. These tests read
// app/globals.css as text and check that structurally: the clip-path rule on
// .write-ink exists, only inside a selector naming .js-ready, and only
// inside the `prefers-reduced-motion: no-preference` media query (never
// unscoped). This is deliberately crude (string/regex parsing of a
// stylesheet, not a real CSS parser) but it is the thing that can actually
// fail when someone moves that rule, which is the point: verified below by
// simulating three regressions (unscoping from .js-ready, deleting the rule
// entirely, adding an unguarded copy outside the media query) against a copy
// of this exact parsing logic and confirming each one fails the relevant
// assertion.
describe('the no-JS writing-animation safety design (globals.css)', () => {
  const css = readFileSync(
    path.resolve(__dirname, '../app/globals.css'),
    'utf8',
  )

  // Finds the block for the first regex match of `marker` and returns its
  // content split around the block, using brace-depth counting rather than a
  // single regex, since the block contains nested rules (a plain
  // non-nesting-aware regex cannot find the matching closing brace).
  function extractBlock(source: string, marker: RegExp) {
    const found = marker.exec(source)
    if (!found) {
      throw new Error(`marker not found in globals.css: ${marker}`)
    }
    const start = found.index
    const openBrace = source.indexOf('{', start)
    let depth = 0
    let i = openBrace
    for (; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    const closeBrace = i
    return {
      inner: source.slice(openBrace + 1, closeBrace),
      before: source.slice(0, start),
      after: source.slice(closeBrace + 1),
    }
  }

  // Finds flat `selector { body }` rules. Good enough here because this
  // stylesheet nests at most one level (rules inside @media), so the
  // innermost-brace-pair regex below correctly isolates each rule; it is not
  // a general CSS parser.
  function findRules(source: string) {
    const rules: { selector: string; body: string }[] = []
    for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      rules.push({ selector: match[1], body: match[2] })
    }
    return rules
  }

  it('scopes the .write-ink clip-path rule under both .js-ready and the no-preference media query', () => {
    const { inner } = extractBlock(
      css,
      /@media \(prefers-reduced-motion: no-preference\)/,
    )
    const guarded = findRules(inner).filter(
      (rule) => rule.selector.includes('.write-ink') && rule.body.includes('clip-path'),
    )
    // Fails if the rule is deleted (regressed to an inline motion prop) or
    // never existed in the first place.
    expect(guarded.length).toBeGreaterThan(0)
    // Fails if the rule is present but no longer gated on .js-ready.
    for (const rule of guarded) {
      expect(rule.selector).toContain('.js-ready')
    }
  })

  it('never clips .write-ink outside that guarded media block', () => {
    const { before, after } = extractBlock(
      css,
      /@media \(prefers-reduced-motion: no-preference\)/,
    )
    // @keyframes blocks legitimately reference clip-path on their own
    // from/to selectors, not on .write-ink, so strip them first to avoid a
    // false positive there while still catching a stray unguarded rule.
    const outside = (before + after).replace(
      /@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g,
      '',
    )
    const offenders = findRules(outside).filter(
      (rule) => rule.selector.includes('.write-ink') && rule.body.includes('clip-path'),
    )
    // Fails if an unguarded copy of the rule is added anywhere else in the
    // stylesheet, e.g. outside the reduced-motion media query.
    expect(offenders).toEqual([])
  })
})
