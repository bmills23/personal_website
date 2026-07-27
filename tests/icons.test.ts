import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { ICONS } from '@/scripts/icon-list.mjs'

describe('sketched icons', () => {
  it('declares at least one icon', () => {
    expect(ICONS.length).toBeGreaterThan(0)
  })

  it('generates a well-formed sketched svg for every declared icon', () => {
    const seenIds = new Set<string>()
    for (const name of ICONS) {
      const path = `public/icons/${name}.svg`
      expect(existsSync(path), `${path} missing, run: npm run icons`).toBe(true)
      const svg = readFileSync(path, 'utf8')

      expect(svg).toContain('<svg')
      expect(svg).toContain('currentColor')

      // components/Icon.tsx resizes icons by string-replacing width/height on
      // the root <svg>. Those attributes must exist or the size prop is a
      // silent no-op (Phosphor's raw source has no width/height, only viewBox).
      expect(svg, `${name}: missing width attribute on root <svg>`).toMatch(/<svg[^>]*\swidth="\d+"/)
      expect(svg, `${name}: missing height attribute on root <svg>`).toMatch(/<svg[^>]*\sheight="\d+"/)

      // Hand-drawn treatment: a <defs><filter> must exist and a <g> must
      // actually reference it, or the filter is declared but never applied.
      const filterMatch = svg.match(/<defs>.*?<filter id="([^"]+)">.*?<\/filter>.*?<\/defs>/s)
      expect(filterMatch, `${name}: no <defs><filter> found`).not.toBeNull()
      const filterId = filterMatch![1]
      expect(svg, `${name}: no <g> references filter #${filterId}`).toContain(
        `<g filter="url(#${filterId})">`
      )

      // Each icon's filter id must be unique per icon (rough-<name>), not a
      // shared literal id: components/Icon.tsx inlines each icon as its own
      // sibling <svg> in the page DOM, so a shared id collides the moment two
      // icons render on one page, and url(#..) resolves to the first match
      // rather than each icon's own filter.
      expect(filterId, `${name}: filter id is not scoped per-icon`).toBe(`rough-${name}`)
      expect(seenIds.has(filterId), `${name}: filter id "${filterId}" reused by another icon`).toBe(
        false
      )
      seenIds.add(filterId)
    }
  })
})
