import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { contrastRatio } from '@/lib/contrast'

// Reads the live design tokens out of app/globals.css rather than hardcoding
// hex literals here. Hardcoded literals cannot catch a palette regression:
// changing --color-pencil back to the twice-rejected #8A939E in the
// stylesheet would leave every hardcoded-literal assertion passing, on the
// exact token that failed AA twice (see the ledger at
// .superpowers/sdd/2026-07-27-personal-website-foundation/progress.md, Task 2).
// Parsing the stylesheet is what makes these tests track the real palette.
const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')

function extractThemeColors(source: string): Record<string, string> {
  const match = /@theme\s*\{([^}]*)\}/.exec(source)
  if (!match) {
    throw new Error('no @theme block found in app/globals.css')
  }
  const colors: Record<string, string> = {}
  for (const line of match[1].matchAll(/--color-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    colors[line[1]] = line[2]
  }
  return colors
}

const THEME_COLORS = extractThemeColors(css)

function color(name: string): string {
  const value = THEME_COLORS[name]
  if (!value) {
    throw new Error(`--color-${name} not found in app/globals.css's @theme block`)
  }
  return value
}

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
  })
  it('returns 1 for a colour against itself', () => {
    expect(contrastRatio('#16305C', '#16305C')).toBeCloseTo(1, 5)
  })
})

describe('palette meets WCAG AA (read live from app/globals.css)', () => {
  it('ink on paper passes for body text', () => {
    expect(contrastRatio(color('ink'), color('paper'))).toBeGreaterThanOrEqual(4.5)
  })
  it('graphite on paper passes for body text', () => {
    expect(contrastRatio(color('graphite'), color('paper'))).toBeGreaterThanOrEqual(4.5)
  })
  it('pencil on paper passes for small text', () => {
    expect(contrastRatio(color('pencil'), color('paper'))).toBeGreaterThanOrEqual(4.5)
  })
  it('pencil on card passes for small text', () => {
    expect(contrastRatio(color('pencil'), color('card'))).toBeGreaterThanOrEqual(4.5)
  })
  it('stamp on paper passes for large text and UI', () => {
    expect(contrastRatio(color('stamp'), color('paper'))).toBeGreaterThanOrEqual(3)
  })
  it('rejects the original pencil grey that failed AA', () => {
    // Deliberately the one still-hardcoded literal in this file: this is the
    // historical rejected value being tested against, not a live token, so
    // there is nothing in globals.css to read it from.
    expect(contrastRatio('#8A939E', color('paper'))).toBeLessThan(4.5)
  })
  it('the contact form control border reaches 3:1 against the card fill (WCAG 1.4.11)', () => {
    // components/ContactForm.tsx: the border is the only indicator of where
    // each input/textarea sits, so it is non-text UI, not decoration, and
    // must clear the 3:1 non-text-contrast floor, not the 4.5:1 text floor.
    expect(contrastRatio(color('control-border'), color('card'))).toBeGreaterThanOrEqual(3)
  })
})
