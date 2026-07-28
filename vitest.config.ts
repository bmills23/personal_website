import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    // Required so @testing-library/react's own auto-cleanup (an
    // `afterEach` it registers only if it finds a global `afterEach`
    // function at import time) actually runs. Without this, jsdom test
    // files that call `render()` more than once accumulate DOM across
    // `it()` blocks in the same file, since nothing unmounts between
    // tests; assertions against `screen` or `document.body` then see
    // leftover markup from earlier tests. tests/login-card.test.tsx is
    // the first suite in this repo to rely on `screen`/`document.body`
    // across multiple renders in one file, which is what surfaced this.
    globals: true,
    environment: 'node',
    // The suite defaults to the node environment (see `environment` above).
    // tests/**/*.test.tsx opts into jsdom via a per-file
    // `// @vitest-environment jsdom` pragma rather than switching the whole
    // suite; see written-heading.test.tsx and the existing Reveal tests for
    // the same pattern applied to .ts files.
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
