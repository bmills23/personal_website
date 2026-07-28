import { readFileSync, existsSync } from 'node:fs'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

// Unmounts anything @testing-library/react rendered into jsdom after every
// test. Without this, render() calls accumulate DOM across it() blocks in
// the same file (nothing ever unmounts), so assertions against `screen` or
// `document.body` can see leftover markup from an earlier test. This is a
// no-op for the plain-node tests in this suite: cleanup() only touches
// containers that render() actually mounted, and no test file here calls
// render() outside a `// @vitest-environment jsdom` pragma.
afterEach(() => {
  cleanup()
})
