import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { forgeSessionCookie } from './helpers/session'

// --- Env note -------------------------------------------------------------
//
// Every suite below except "visitor DOM purity" and "/login logged out"
// forges an Auth.js session cookie (`forgeSessionCookie`, e2e/helpers/session.ts),
// which reads process.env.AUTH_SECRET directly in THIS process (the
// Playwright test runner), not just in the dev server it spawns. A plain
// `npx playwright test e2e/editor.spec.ts` run from a shell that never
// exported AUTH_SECRET will throw "AUTH_SECRET missing..." for those tests.
// Run this file via `npm run e2e:editor` (or
// `node --env-file=.env.local node_modules/.bin/playwright test e2e/editor.spec.ts`)
// so the same process that spawns the `next dev` webServer also carries
// AUTH_SECRET/ADMIN_GITHUB_LOGIN into it (child processes inherit the
// parent's env by default, which is why one `--env-file` covers both).
//
// SAFETY: once DATABASE_URL is fixed, `next dev` writes to the PRODUCTION
// content row (there is no separate dev database). Every mutation this file
// makes is undone before the test exits via try/finally, using a marker
// value that embeds testInfo.workerIndex so a crashed run's leftover text is
// traceable to a specific run. Do not remove the try/finally blocks below to
// "simplify" them.

const TOOLBAR_UNAVAILABLE_MESSAGE = 'editor state unavailable: check DATABASE_URL in .env.local'
const HINT_KEY = 'bgm-editor'

async function primeAdminSession(page: Page, context: BrowserContext): Promise<void> {
  const login = process.env.ADMIN_GITHUB_LOGIN
  if (!login) {
    throw new Error('ADMIN_GITHUB_LOGIN missing from the environment; run via node --env-file or export it')
  }
  await context.addCookies([await forgeSessionCookie(login)])
  // First load establishes the origin so localStorage has somewhere to
  // write to; the hint is set only after that, then a reload is what
  // actually triggers EditProvider's getEditorState() check (see
  // components/editor/EditProvider.tsx: the hint-check effect runs on every
  // mount, and the hint would not exist yet on this very first navigation).
  await page.goto('/')
  await page.evaluate((key) => window.localStorage.setItem(key, '1'), HINT_KEY)
  await page.reload()
}

/**
 * The precondition every admin-session test shares: the toolbar can only
 * appear once getEditorState() (a server action reading the live content
 * row) resolves { ok: true }. With the known stale-password DATABASE_URL,
 * this fails here with the message below rather than the test degrading
 * into some other, less actionable assertion failure. Once DATABASE_URL is
 * fixed, this same assertion becomes the thing that proves the round trip's
 * setup succeeded, unmodified.
 */
async function expectToolbarVisible(page: Page): Promise<void> {
  await expect(
    page.getByRole('button', { name: 'Edit page' }),
    TOOLBAR_UNAVAILABLE_MESSAGE,
  ).toBeVisible({ timeout: 15_000 })
}

/**
 * Waits for the toolbar's aria-live status region to leave its transient
 * states ('' idle, 'Saving') and settle on a terminal one (either 'Saved' or
 * one of saveErrorMessage's strings), then returns that final text.
 *
 * This exists so that every place in this file that performs a save/revert
 * and then decides whether to flip a `markerPending` cleanup flag can do so
 * from the REAL outcome, not from an assertion that may or may not have
 * thrown. The critical property: the caller reads the return value and
 * updates its own bookkeeping BEFORE making any assertion against it, so a
 * later assertion failing (e.g. this returns an error string, not 'Saved')
 * can never leave bookkeeping in a state that assumes the mutation
 * succeeded when it did not, and - the specific bug this replaced - a
 * mutation that DID succeed can never be left looking "still pending" just
 * because a status assertion happened to be checked before the mutation's
 * own success was recorded.
 */
async function waitForSaveOutcome(page: Page): Promise<string> {
  const status = page.locator('[aria-live="polite"]')
  await expect
    .poll(async () => (await status.textContent()) ?? '', { timeout: 15_000 })
    .not.toMatch(/^(|Saving)$/)
  return (await status.textContent()) ?? ''
}

test.describe('visitor DOM purity', () => {
  test('a logged-out visitor sees zero editing affordances anywhere in the DOM', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[contenteditable]')).toHaveCount(0)
    await expect(page.locator('[data-editable]')).toHaveCount(0)
    await expect(page.getByText('Revert last save')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit page' })).toHaveCount(0)
  })

  // "Five section headings and the hero name": the site has four in-section
  // <h2> headings (About, Products, Work, Contact - see
  // components/sections/*.tsx, each via HeadingEditable/WrittenHeading) plus
  // the hero's own <h1> name, which is not itself inside a "section" the way
  // the other four are (components/sections/Hero.tsx). Read together that is
  // five heading-level elements on the page; this test checks all five, with
  // the hero's h1 named explicitly since the brief calls it out separately
  // from the four h2 "section headings".
  test('with JavaScript disabled, all five section headings and the hero name render as text', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bryan G. Mills')

    const sectionHeadings = ['Two careers, one set of tools', 'Products', 'Work', 'Get in touch']
    for (const name of sectionHeadings) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    }

    await context.close()
  })

  test('/login shows the sign-in card and carries noindex when signed out', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Owner sign-in' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in with GitHub' })).toBeVisible()

    const robots = page.locator('meta[name="robots"]')
    await expect(robots).toHaveAttribute('content', /noindex/)
  })
})

test.describe('non-admin session is refused', () => {
  test('a forged non-admin cookie never unlocks the toolbar, and the hint is cleared', async ({
    page,
    context,
  }) => {
    await context.addCookies([await forgeSessionCookie('someone-else')])
    await page.goto('/')
    await page.evaluate((key) => window.localStorage.setItem(key, '1'), HINT_KEY)
    await page.reload()

    // Wait for the hint to be cleared first: that only happens in
    // EditProvider's effect once getEditorState() has actually resolved
    // { ok: false } and set session to 'none' (see EditProvider.tsx), which
    // is the proof the toolbar's absence below is a real "refused" outcome
    // and not just "hasn't rendered yet".
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), HINT_KEY))
      .toBeNull()

    await expect(page.getByRole('button', { name: 'Edit page' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Revert last save' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
  })
})

test.describe('admin editing round-trip', () => {
  // Requires a working DATABASE_URL: getEditorState, saveField, and
  // revertLastSave all read/write the live content row.
  test.beforeEach(async ({ page, context }, testInfo) => {
    // Both tests in this describe mutate the single shared `about.heading`
    // field on the live content row. The 'desktop' and 'mobile' Playwright
    // projects run this file concurrently by default (different projects
    // are independent worker pools), so running these tests under both
    // would race two saves/reverts against the same row. Gating to one
    // project keeps the mutation single-threaded; the toolbar's rendering
    // itself is already covered on both projects by the purity/non-admin
    // suites above, and mobile's own toolbar-specific behavior gets its own
    // describe block below.
    test.skip(testInfo.project.name !== 'desktop', 'admin round-trip runs once, against the desktop project only')
    await primeAdminSession(page, context)
    await expectToolbarVisible(page)
  })

  test('editing the About heading persists across reload, and Revert last save restores it', async ({
    page,
  }, testInfo) => {
    await page.getByRole('button', { name: 'Edit page' }).click()

    const heading = page.getByRole('textbox', { name: 'Edit about.heading' })
    const originalHeading = (await heading.textContent())?.trim() ?? ''
    const marker = `E2E heading ${testInfo.workerIndex}`

    // Set once the marker save's outcome is REAL AND KNOWN to be a success,
    // cleared the same way once the revert's outcome is known to be a
    // success. Both flips happen before the corresponding `expect(...)`
    // below, so a later assertion throwing can never leave this flag
    // disagreeing with what actually happened server-side. The finally
    // block below only acts while this is true: a normal successful run
    // (whose main body already reverts) never double-reverts, and a run
    // that fails partway still cleans up.
    let markerPending = false
    try {
      await heading.selectText()
      await heading.pressSequentially(marker)
      await heading.press('Enter')
      const saveOutcome = await waitForSaveOutcome(page)
      if (saveOutcome === 'Saved') markerPending = true
      expect(saveOutcome, 'the marker save did not report success').toBe('Saved')

      await page.goto('/')
      await expect(page.locator('#about').getByRole('heading', { level: 2 })).toHaveText(marker)

      await expectToolbarVisible(page)
      page.once('dialog', (dialog) => dialog.accept())
      await page.getByRole('button', { name: 'Revert last save' }).click()
      const revertOutcome = await waitForSaveOutcome(page)
      if (revertOutcome === 'Saved') markerPending = false
      expect(revertOutcome, 'Revert last save did not report success').toBe('Saved')

      await page.goto('/')
      await expect(page.locator('#about').getByRole('heading', { level: 2 })).toHaveText(originalHeading)
    } finally {
      if (markerPending) {
        try {
          await page.goto('/')
          await expectToolbarVisible(page)
          page.once('dialog', (dialog) => dialog.accept())
          await page.getByRole('button', { name: 'Revert last save' }).click()
          const cleanupOutcome = await waitForSaveOutcome(page)
          if (cleanupOutcome !== 'Saved') {
            throw new Error(`emergency revert did not report success (status: "${cleanupOutcome}")`)
          }
        } catch (cleanupError) {
          console.error(
            `worker ${testInfo.workerIndex}: EMERGENCY CLEANUP FAILED - about.heading may still hold "${marker}"`,
            cleanupError,
          )
        }
      }
    }
  })

  test('a stale save from a second page surfaces the conflict and reverts that page field', async ({
    page,
    context,
  }, testInfo) => {
    const pageA = page
    const pageB = await context.newPage()
    try {
      // pageB does not need its own primeAdminSession call: the cookie was
      // added at the context level, and localStorage is shared per-origin
      // across every page/tab in one BrowserContext, so pageA's earlier
      // primeAdminSession already persisted the hint for pageB too.
      await pageB.goto('/')
      await expectToolbarVisible(pageB)

      await pageA.getByRole('button', { name: 'Edit page' }).click()
      await pageB.getByRole('button', { name: 'Edit page' }).click()

      const headingA = pageA.getByRole('textbox', { name: 'Edit about.heading' })
      const headingB = pageB.getByRole('textbox', { name: 'Edit about.heading' })
      const originalHeading = (await headingB.textContent())?.trim() ?? ''
      const markerA = `E2E heading ${testInfo.workerIndex}-stale-a`
      const markerB = `E2E heading ${testInfo.workerIndex}-stale-b`

      let markerPending = false
      try {
        // Page A saves first: its token was current, so this succeeds and
        // advances the row's updatedAt.
        await headingA.selectText()
        await headingA.pressSequentially(markerA)
        await headingA.press('Enter')
        const saveOutcome = await waitForSaveOutcome(pageA)
        if (saveOutcome === 'Saved') markerPending = true
        expect(saveOutcome, 'page A save did not report success').toBe('Saved')

        // Page B never reloaded, so it still holds the pre-A token. Its
        // save must be refused as stale, not silently overwrite A's write.
        await headingB.selectText()
        await headingB.pressSequentially(markerB)
        await headingB.press('Enter')

        await expect(pageB.locator('[aria-live="polite"]')).toHaveText(/page changed elsewhere/i)
        // commitField's restore callback resets the DOM to the last value
        // THIS page successfully saved, which for page B is the original
        // text (it never had a successful save of its own).
        await expect(headingB).toHaveText(originalHeading)
      } finally {
        if (markerPending) {
          try {
            await pageA.goto('/')
            await expectToolbarVisible(pageA)
            pageA.once('dialog', (dialog) => dialog.accept())
            await pageA.getByRole('button', { name: 'Revert last save' }).click()
            const cleanupOutcome = await waitForSaveOutcome(pageA)
            if (cleanupOutcome !== 'Saved') {
              throw new Error(`emergency revert did not report success (status: "${cleanupOutcome}")`)
            }
          } catch (cleanupError) {
            console.error(
              `worker ${testInfo.workerIndex}: EMERGENCY CLEANUP FAILED - about.heading may still hold "${markerA}"`,
              cleanupError,
            )
          }
        }
      }
    } finally {
      await pageB.close()
    }
  })
})

test.describe('mobile toolbar', () => {
  test('the toolbar renders on a real phone viewport with zero horizontal overflow', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'iPhone 14 project only')
    await primeAdminSession(page, context)
    await expectToolbarVisible(page)

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(scrollWidth, `scrollWidth (${scrollWidth}) must not exceed innerWidth (${innerWidth})`).toBeLessThanOrEqual(
      innerWidth,
    )
  })
})
