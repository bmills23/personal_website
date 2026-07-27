import { test, expect } from '@playwright/test'

// --- Carried-forward test 2: js-ready survives hydration -------------------
//
// The inline <head> script in app/layout.tsx adds `js-ready` to
// document.documentElement.classList before React hydrates, so the <html>
// element's className will not match the server-rendered value at hydration
// time. app/layout.tsx addresses this with `suppressHydrationWarning` on
// <html> only. If that class were ever stripped during hydration, the
// ink-wipe animation would silently never fire again: headings would render
// unclipped forever, which looks fine but means the whole feature is
// permanently inert with no visible symptom.
//
// This MUST run against a production build (`next build && next start`),
// not `next dev`: hydration timing, warning behaviour, and any future React
// version can differ between dev and prod. See playwright.prod.config.ts.
//
// Adapted from the spec recommended in
// .superpowers/sdd/2026-07-27-personal-website-foundation/task-6b-report.md,
// which was written before this harness existed and is treated as untested
// until proven here.
test('js-ready survives hydration and the About heading writes itself in', async ({ page }) => {
  // Detect hydration completion via a real signal rather than a fixed sleep:
  // WrittenHeading's useEffect calls IntersectionObserver.observe() on
  // mount, which only happens once React has actually hydrated that client
  // component.
  await page.addInitScript(() => {
    const NativeIO = window.IntersectionObserver
    ;(window as unknown as { __ioObserveCount: number }).__ioObserveCount = 0
    window.IntersectionObserver = class extends NativeIO {
      observe(...args: Parameters<IntersectionObserver['observe']>) {
        ;(window as unknown as { __ioObserveCount: number }).__ioObserveCount++
        return super.observe(...args)
      }
    }
  })

  await page.goto('/')
  await page.waitForFunction(
    () => (window as unknown as { __ioObserveCount?: number }).__ioObserveCount! > 0,
  )

  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.classList.contains('js-ready')),
    )
    .toBe(true)

  // Give hydration a moment to fully settle, then check again: the concern
  // this test exists for is the class getting silently patched back out by
  // a delayed reconciliation pass, not just missing at the first instant.
  await page.waitForTimeout(500)
  const stillJsReady = await page.evaluate(() =>
    document.documentElement.classList.contains('js-ready'),
  )
  expect(stillJsReady).toBe(true)

  const heading = page.locator('#about [data-write]')
  await heading.scrollIntoViewIfNeeded()
  await expect(heading).toHaveAttribute('data-written', 'true')

  const animationName = await page
    .locator('#about .write-ink')
    .evaluate((el) => getComputedStyle(el).animationName)
  expect(animationName).toBe('ink-wipe')

  // Let the 0.7s ink-wipe animation finish, then confirm the heading ends
  // up fully revealed rather than stuck clipped.
  await page.waitForTimeout(900)
  const clipPath = await page
    .locator('#about .write-ink')
    .evaluate((el) => getComputedStyle(el).clipPath)
  // Chromium renders the fully-revealed inset as "0px" on some sides and
  // "0%" on others depending on version; both mean zero clipping on every
  // side, which is what "fully revealed" requires. Match either unit.
  expect(clipPath).toMatch(/^inset\(0px (0px|0%) 0px 0px\)$/)
})
