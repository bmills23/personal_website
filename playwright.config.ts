import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    // Deliberately false, not the brief's suggested `true`. With
    // reuseExistingServer:true, Playwright silently attaches to whatever is
    // already bound to port 3000 instead of starting a fresh server from
    // this checkout: a stale/orphaned `next-server` left running from an
    // earlier session would make the whole suite test old code while
    // reporting green. That exact failure has already happened once on this
    // machine (an orphaned server sat on port 3000 for fifteen minutes).
    // With this set to false, Playwright always spawns its own server for
    // the run and fails loudly at startup if port 3000 is already taken,
    // instead of quietly reusing it.
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
