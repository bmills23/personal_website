import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { ICONS } from '@/scripts/icon-list.mjs'

describe('sketched icons', () => {
  it('declares at least one icon', () => {
    expect(ICONS.length).toBeGreaterThan(0)
  })

  it('generates an svg for every declared icon', () => {
    for (const name of ICONS) {
      const path = `public/icons/${name}.svg`
      expect(existsSync(path), `${path} missing, run: npm run icons`).toBe(true)
      const svg = readFileSync(path, 'utf8')
      expect(svg).toContain('<svg')
      expect(svg).toContain('currentColor')
    }
  })
})
