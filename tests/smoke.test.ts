import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('project setup', () => {
  it('declares the pinned Next.js version', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(pkg.dependencies.next).toBe('16.2.12')
  })

  it('enables cacheComponents so the use cache directive works', () => {
    const config = readFileSync('next.config.ts', 'utf8')
    expect(config).toContain('cacheComponents: true')
  })
})
