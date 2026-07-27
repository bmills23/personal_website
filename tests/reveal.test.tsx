// @vitest-environment jsdom
//
// Reveal (components/shell/Reveal.tsx) follows the same pattern as
// WrittenHeading (see tests/written-heading.test.tsx): a plain div, always
// present in the server-rendered HTML and the accessibility tree, with the
// hidden state and the transition owned entirely by CSS in app/globals.css,
// gated on a `.js-ready` class inside `prefers-reduced-motion:
// no-preference`.
//
// This rewrite replaces the previous framer-motion implementation, which
// wrapped children in `motion.div` with an `initial={{opacity: 0, ...}}`
// prop. framer-motion applies `initial` synchronously into the
// server-rendered HTML, so About, every product card, and both work tracks
// rendered with `style="opacity:0;transform:..."` and were invisible with
// JavaScript off. Separately, `useReducedMotion()` returns `null` during
// server render, so the server always emitted the `motion.div` wrapper,
// while a reduced-motion client's first render emitted `<>{children}</>`
// with no wrapper at all: a structural hydration mismatch (different
// element count) that `suppressHydrationWarning` on `<html>` does not cover,
// since that is scoped to `<html>`'s own attributes.
//
// The old tests for this component lived in two files, one per
// window.matchMedia preference, because framer-motion's reduced-motion
// detector read matchMedia once per module instance and never again, so the
// two preferences needed isolated module registries. This rewrite has no
// runtime branch on reduced-motion preference at all (the CSS media query
// does that work) and no motion import, so that split is no longer needed:
// both properties below live in this one file.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Reveal } from '@/components/shell/Reveal'

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

describe('Reveal', () => {
  it('renders its children even when the animation never runs', () => {
    render(
      <Reveal>
        <p>hello</p>
      </Reveal>,
    )
    expect(screen.getByText('hello')).toBeTruthy()
  })

  // The five component-side tests above/below render into jsdom, which
  // builds the DOM regardless of CSS and asserts nothing about visibility,
  // so they would keep passing even if this component regressed to the
  // forbidden `motion.div` pattern with a hidden `initial` prop: the child
  // would still exist, just styled invisible. This test closes that gap the
  // way jsdom actually can: by asserting the wrapper itself carries no
  // inline style that hides content. Verified against the real regression:
  // rendering a throwaway `motion.div` with `initial={{opacity: 0, y: 16}}`
  // produces `style="opacity:0;transform:translateY(16px)"` in jsdom (motion
  // applies `initial` synchronously during the first render), so this
  // assertion does fail against that pattern, not just against a
  // hypothetical.
  it('carries no inline hiding style, so hiding is CSS-owned rather than baked into the render', () => {
    const { container } = render(
      <Reveal>
        <p>hello</p>
      </Reveal>,
    )
    const wrapper = container.querySelector<HTMLElement>('[data-reveal]')
    expect(wrapper).not.toBeNull()
    expect(wrapper?.style.opacity).toBe('')
    expect(wrapper?.style.transform).toBe('')
  })

  it('marks the variant so CSS can select the right hidden transform', () => {
    const { container: rise } = render(
      <Reveal variant="rise">
        <p>a</p>
      </Reveal>,
    )
    expect(rise.querySelector('[data-reveal]')?.getAttribute('data-reveal')).toBe('rise')

    const { container: card } = render(
      <Reveal variant="card">
        <p>b</p>
      </Reveal>,
    )
    expect(card.querySelector('[data-reveal]')?.getAttribute('data-reveal')).toBe('card')
  })

  it('starts unrevealed so the animation has somewhere to go', () => {
    const { container } = render(
      <Reveal>
        <p>hello</p>
      </Reveal>,
    )
    expect(container.querySelector('[data-reveal]')?.getAttribute('data-revealed')).toBeNull()
  })

  it('exposes a non-zero delay only as a CSS custom property, never as an inline hiding style', () => {
    const { container } = render(
      <Reveal delay={0.16}>
        <p>hello</p>
      </Reveal>,
    )
    const wrapper = container.querySelector<HTMLElement>('[data-reveal]')
    expect(wrapper?.style.getPropertyValue('--reveal-delay')).toBe('0.16s')
    expect(wrapper?.style.opacity).toBe('')
  })

  it('omits the style attribute entirely at the default zero delay', () => {
    const { container } = render(
      <Reveal>
        <p>hello</p>
      </Reveal>,
    )
    expect(container.querySelector('[data-reveal]')?.hasAttribute('style')).toBe(false)
  })
})

// The component-side tests above only prove Reveal itself renders no inline
// hiding style. They say nothing about whether the CSS that is supposed to
// own the hiding still exists and is still correctly gated. These tests read
// app/globals.css as text and check that structurally, the same approach
// tests/written-heading.test.tsx uses for the write-ink rule: the hidden
// opacity/transform rules for [data-reveal] exist, only inside a selector
// naming .js-ready, and only inside the `prefers-reduced-motion:
// no-preference` media query (never unscoped). Deliberately crude
// (string/regex parsing of a stylesheet, not a real CSS parser), but it is
// the thing that can actually fail when someone moves that rule.
describe('the no-JS reveal safety design (globals.css)', () => {
  const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')

  // Finds every top-level block matching `marker`, using brace-depth
  // counting (not a single regex) since these blocks nest one level. Returns
  // each block's own text span (`full`) alongside its inner content, because
  // globals.css contains two separate `no-preference` media queries (one for
  // the write-ink rule, one for reveal) and both need to be locatable and
  // removable independently.
  function extractAllBlocks(source: string, marker: RegExp) {
    const blocks: { inner: string; full: string }[] = []
    const global = new RegExp(marker.source, 'g')
    let found: RegExpExecArray | null
    while ((found = global.exec(source))) {
      const openBrace = source.indexOf('{', found.index)
      let depth = 0
      let i = openBrace
      for (; i < source.length; i++) {
        if (source[i] === '{') depth++
        else if (source[i] === '}') {
          depth--
          if (depth === 0) break
        }
      }
      blocks.push({
        inner: source.slice(openBrace + 1, i),
        full: source.slice(found.index, i + 1),
      })
      global.lastIndex = i + 1
    }
    return blocks
  }

  function findRules(source: string) {
    const rules: { selector: string; body: string }[] = []
    for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      rules.push({ selector: match[1], body: match[2] })
    }
    return rules
  }

  const isHiddenRevealRule = (rule: { selector: string; body: string }) =>
    rule.selector.includes('[data-reveal') && /opacity:\s*0\b/.test(rule.body)

  const mediaBlocks = extractAllBlocks(css, /@media \(prefers-reduced-motion: no-preference\)/)

  it('has a no-preference media block containing the [data-reveal] hidden-state rules', () => {
    const revealBlock = mediaBlocks.find((block) => block.inner.includes('[data-reveal'))
    expect(revealBlock).toBeDefined()
  })

  it('scopes the [data-reveal] hidden-state rules under both .js-ready and the no-preference media query', () => {
    const revealBlock = mediaBlocks.find((block) => block.inner.includes('[data-reveal'))!
    const guarded = findRules(revealBlock.inner).filter(isHiddenRevealRule)
    // Fails if the rules are deleted (regressed to an inline motion prop) or
    // never existed.
    expect(guarded.length).toBeGreaterThan(0)
    // Fails if present but no longer gated on .js-ready.
    for (const rule of guarded) {
      expect(rule.selector).toContain('.js-ready')
    }
  })

  it('never hides [data-reveal] outside a guarded media block', () => {
    let outside = css
    for (const block of mediaBlocks) {
      outside = outside.replace(block.full, '')
    }
    // @keyframes blocks legitimately reference opacity on their own
    // from/to selectors elsewhere in this file, not on [data-reveal], so
    // strip them first to avoid a false positive there while still catching
    // a stray unguarded rule.
    outside = outside.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
    const offenders = findRules(outside).filter(isHiddenRevealRule)
    // Fails if an unguarded copy of the rule is added anywhere else in the
    // stylesheet, e.g. outside the reduced-motion media query.
    expect(offenders).toEqual([])
  })

  // The component's `variant` prop and the CSS `[data-reveal='...']`
  // selectors are two independent literals that have to agree by hand: the
  // component's `data-reveal={variant}` attribute is only ever hidden if
  // some `.js-ready [data-reveal='<value>']` rule matches it. Nothing in
  // TypeScript ties them together (data-* attribute values are not typed),
  // so renaming one side, e.g. Reveal's variant literal 'card' to 'cards',
  // or adding a third variant to the prop type without a matching CSS rule,
  // would compile and render fine while silently losing the intended hidden
  // state for that variant (it would just render already visible, with no
  // failing test anywhere else in this file: the tests above only check
  // that *some* guarded [data-reveal] rule exists, not that every variant
  // value the component can emit has one). This reads both sides as text
  // and asserts the sets of literal values are exactly equal.
  it('the CSS hidden-variant selectors match the component variant prop values exactly', () => {
    const componentSource = readFileSync(
      path.resolve(__dirname, '../components/shell/Reveal.tsx'),
      'utf8',
    )
    const variantType = /variant\?:\s*((?:'[a-z]+'\s*\|?\s*)+)/.exec(componentSource)
    expect(variantType, 'variant prop type not found in Reveal.tsx').not.toBeNull()
    const componentVariants = new Set(
      [...variantType![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]),
    )
    expect(componentVariants.size).toBeGreaterThan(0)

    const cssVariants = new Set(
      [...css.matchAll(/\[data-reveal='([a-z]+)'\]/g)].map((m) => m[1]),
    )

    expect(cssVariants).toEqual(componentVariants)
  })
})
