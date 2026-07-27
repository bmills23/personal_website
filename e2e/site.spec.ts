import { test, expect } from '@playwright/test'

test('renders the hero from content', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bryan G. Mills')
})

test('shows both products with working links', async ({ page }) => {
  await page.goto('/')
  // exact: true, because without it Playwright's substring accessible-name
  // matching also matches the "TerminaLLM LLC" work-track heading, causing
  // a strict-mode violation (verified: it does, and did, before this fix).
  await expect(page.getByRole('heading', { name: 'TerminaLLM', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Parolejo' })).toBeVisible()
  await expect(page.getByRole('link', { name: /terminallm\.app/ })).toHaveAttribute(
    'href',
    'https://terminallm.app',
  )
  await expect(page.getByRole('link', { name: /parolejo\.app/ })).toHaveAttribute(
    'href',
    'https://parolejo.app',
  )
})

test('shows both work tracks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Track 01 / Science')).toBeVisible()
  await expect(page.getByText('Track 02 / Software')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'State of Colorado' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'TerminaLLM LLC' })).toBeVisible()
})

test('server-renders content for link-preview crawlers', async ({ request }) => {
  // Uses the `request` fixture, a raw HTTP client with no JS execution at
  // all, rather than `page`, which would hydrate and could mask a
  // regression to client-side fetching. This is the test that justifies
  // the migration off the Vite SPA: link-preview crawlers read raw HTML.
  const response = await request.get('/')
  // A 500 (or any non-2xx) must not be able to masquerade as a content
  // failure below: fail on the status first, with its own clear message.
  expect(response.ok(), `expected 200 OK, got ${response.status()}`).toBe(true)
  const html = await response.text()

  // Every assertion below is scoped to the specific element that should
  // carry the string, not to <body> or the whole document as a substring
  // haystack. Two rounds of that mistake were found and fixed here:
  //
  // Round 1: checking the whole document. <head> metadata (the <title>
  // tag and the openGraph/description meta tags in app/layout.tsx)
  // independently contains "Bryan G. Mills", "TerminaLLM", and "Parolejo"
  // as static strings, so `html.includes(...)` against the full document
  // would still pass even if the visible page content were regressed to
  // render only after client-side JavaScript ran.
  //
  // Round 2: checking <body> as a whole was not enough either. "TerminaLLM"
  // is a substring of the Work section's "TerminaLLM LLC" heading, so if
  // ONLY the Products section regressed to client-only rendering,
  // `body.toContain('TerminaLLM')` would still pass, satisfied by the
  // unrelated, still-server-rendered Work entry. Likewise "State of
  // Colorado" also appears inside an About paragraph ("For the State of
  // Colorado I work as..."), so a body-wide check could not tell a broken
  // Work section from an intact About section either.
  //
  // Anchoring each string to its own heading tag closes both gaps: each
  // regex only matches if that exact string is the entire text content of
  // its specific <h1>/<h3>, which is only true if that section's own
  // server render produced it. All four were mutation-tested individually;
  // see the "Carried-forward test evidence" section of the task report.
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/)
  expect(bodyMatch).not.toBeNull()
  const body = bodyMatch![1]

  // Hero <h1> (app/components/sections/Hero.tsx).
  expect(body).toMatch(/<h1[^>]*>Bryan G\. Mills<\/h1>/)
  // Products section, product card heading (Products.tsx).
  expect(body).toMatch(/<h3[^>]*>TerminaLLM<\/h3>/)
  expect(body).toMatch(/<h3[^>]*>Parolejo<\/h3>/)
  // Work section, track entry org heading (Tracks.tsx). Anchored to the
  // exact text "State of Colorado" inside an <h3>, which the About
  // section's prose mention of the same phrase (inside a <p>) cannot
  // satisfy.
  expect(body).toMatch(/<h3[^>]*>State of Colorado<\/h3>/)
})

test('has no horizontal overflow on mobile', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(() => {
    const w = document.documentElement.clientWidth
    return document.documentElement.scrollWidth - w
  })
  expect(overflow).toBeLessThanOrEqual(0.5)
})

test('404 renders the notebook page', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByText('This entry is not in the notebook.')).toBeVisible()
})

test('robots.txt allows crawling and points at the sitemap', async ({ request }) => {
  const response = await request.get('/robots.txt')
  expect(response.ok()).toBe(true)
  const body = await response.text()
  expect(body).toContain('Allow: /')
  expect(body).toContain('https://bryangmills.com/sitemap.xml')
})

test('sitemap.xml lists the homepage', async ({ request }) => {
  const response = await request.get('/sitemap.xml')
  expect(response.ok()).toBe(true)
  const body = await response.text()
  expect(body).toContain('https://bryangmills.com')
})

test('contact form submits', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Name').fill('Playwright')
  await page.getByLabel('Email').fill('playwright@example.com')
  await page.getByLabel('Message').fill('Automated test message.')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Got it. I will get back to you.')).toBeVisible()
})

// --- Carried-forward test 1: no-JavaScript heading visibility -------------
//
// The section headings animate with an ink-wipe implemented as a CSS
// clip-path gated on a `js-ready` class added by an inline <head> script
// (see app/layout.tsx and the `.js-ready [data-write] .write-ink` rule in
// app/globals.css). The design guarantees that without JavaScript nothing
// is clipped and all text renders normally.
//
// A DOM-presence check (e.g. jsdom's getByText) is NOT sufficient to prove
// this: clip-path hides paint without changing layout, so an element clipped
// to zero visible width still reports a full-size bounding box and passes
// Playwright's own toBeVisible() (verified empirically against a synthetic
// clipped heading before writing this test: isVisible() returned true and
// boundingBox() reported the full unclipped size). This test therefore also
// reads the actual computed `clip-path` in a real rendered page, which is
// the property that would break if the CSS gating regressed.
test('section headings are visible with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/')

  // Confirm the premise: with JS disabled, the inline <head> script that
  // adds `js-ready` never ran.
  const jsReady = await page.evaluate(() =>
    document.documentElement.classList.contains('js-ready'),
  )
  expect(jsReady).toBe(false)

  const headings = [
    'Two careers, one set of tools', // About
    'Products',
    'Work',
    'Get in touch', // Contact
  ]

  for (const name of headings) {
    const heading = page.getByRole('heading', { name, exact: true })
    await expect(heading).toBeVisible()

    // page.evaluate still executes via CDP even with javaScriptEnabled:
    // false (that setting only disables page-authored scripts, confirmed
    // by probing it directly), so this reads the real computed style.
    // No fallback to `el` if the selector misses: if `.write-ink` stops
    // matching, that is itself a regression worth failing loudly on,
    // rather than silently checking the wrong element and passing.
    const clipPath = await heading.evaluate((el) => {
      const ink = el.querySelector('.write-ink')
      if (!ink) throw new Error('".write-ink" not found inside heading; selector may have changed')
      return getComputedStyle(ink).clipPath
    })
    expect(clipPath).toBe('none')
  }

  await context.close()
})

// --- Carried-forward test 3: no editing affordances for a logged-out visitor
//
// No content editor exists yet (that ships in a later phase), so this
// currently asserts an absence that must stay true: nothing on the
// rendered page should look editable or gate an editor behind a login.
// Asserted against the rendered DOM, not merely "hidden by CSS" (a
// contenteditable region or an admin control could be present but styled
// invisible, which is exactly the kind of regression a CSS-only check would
// miss).
test('a logged-out visitor sees no editing affordances', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /sign in|log in|edit|admin|save|publish/i }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: /sign in|log in|edit|admin/i }),
  ).toHaveCount(0)
  await expect(
    page.locator('[data-testid*="admin" i], [data-testid*="editor" i]'),
  ).toHaveCount(0)
})
