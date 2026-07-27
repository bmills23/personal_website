import { describe, it, expect } from 'vitest'
import { contrastRatio } from '@/lib/contrast'

const PAPER = '#FBFAF5'
const CARD = '#FFFFFF'

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
  })
  it('returns 1 for a colour against itself', () => {
    expect(contrastRatio('#16305C', '#16305C')).toBeCloseTo(1, 5)
  })
})

describe('palette meets WCAG AA', () => {
  it('ink on paper passes for body text', () => {
    expect(contrastRatio('#16305C', PAPER)).toBeGreaterThanOrEqual(4.5)
  })
  it('graphite on paper passes for body text', () => {
    expect(contrastRatio('#4A5560', PAPER)).toBeGreaterThanOrEqual(4.5)
  })
  it('pencil on paper passes for small text', () => {
    expect(contrastRatio('#68727F', PAPER)).toBeGreaterThanOrEqual(4.5)
  })
  it('pencil on card passes for small text', () => {
    expect(contrastRatio('#68727F', CARD)).toBeGreaterThanOrEqual(4.5)
  })
  it('stamp on paper passes for large text and UI', () => {
    expect(contrastRatio('#B4453C', PAPER)).toBeGreaterThanOrEqual(3)
  })
  it('rejects the original pencil grey that failed AA', () => {
    expect(contrastRatio('#8A939E', PAPER)).toBeLessThan(4.5)
  })
})
