import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

// The inline <head> script in app/layout.tsx adds `js-ready` to
// document.documentElement before React hydrates, so the <html> element's
// className will not match what was server-rendered at hydration time.
// suppressHydrationWarning on <html> (and only <html>) is what tells React
// to accept the DOM's actual value there instead of warning about the
// mismatch. This is a structural, not behavioral, check: it cannot prove
// js-ready actually survives a real hydration pass in a real browser (that
// needs a browser test, see the recommended Playwright spec in
// task-6b-report.md pending Task 10's harness), but it is a cheap guard
// against the specific regression of someone removing the attribute, or
// "fixing" a lint complaint by moving it onto <body> instead, which the
// design explicitly forbids since blanketing suppression there would hide
// real mismatches.
describe('js-ready hydration safety (app/layout.tsx)', () => {
  const source = readFileSync(path.resolve(__dirname, '../app/layout.tsx'), 'utf8')

  // Comments in this file (including the one on the <html> tag itself)
  // legitimately mention "<html>" and "<body>" as prose, which would
  // otherwise trick a naive tag-matching regex into terminating at the
  // comment's own '>' character instead of the real tag's. Stripping both
  // comment styles first makes the tag match resilient to how the
  // surrounding prose is worded.
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

  it('adds js-ready to the document element via a synchronous inline script', () => {
    expect(source).toMatch(/document\.documentElement\.classList\.add\(['"]js-ready['"]\)/)
  })

  it('suppresses the hydration warning on <html>, and only on <html>', () => {
    const htmlTag = withoutComments.match(/<html[^>]*>/)
    expect(htmlTag).not.toBeNull()
    expect(htmlTag![0]).toContain('suppressHydrationWarning')

    const bodyTag = withoutComments.match(/<body[^>]*>/)
    expect(bodyTag).not.toBeNull()
    expect(bodyTag![0]).not.toContain('suppressHydrationWarning')
  })
})
