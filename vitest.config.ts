import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
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
