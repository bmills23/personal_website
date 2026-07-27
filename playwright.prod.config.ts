import { defineConfig, devices } from '@playwright/test'

/**
 * Separate config for the one test (js-ready survival across hydration)
 * that must run against a real production build rather than `next dev`.
 * Runs on its own port (3100) so it can coexist with the dev-mode suite's
 * server on 3000 without a conflict, and so the site.spec.ts run does not
 * pay a `next build` on every invocation.
 */
export default defineConfig({
  testDir: './e2e-prod',
  use: { baseURL: 'http://localhost:3100' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run build && npm run start -- -p 3100',
    url: 'http://localhost:3100',
    // Same reasoning as playwright.config.ts: a hydration test is
    // meaningless if it silently attaches to someone else's stale server.
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
