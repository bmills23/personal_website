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

  // Intercepts the network call rather than letting it reach the real
  // /api/contact route. That route persists every submission to the live
  // production `messages` table (app/api/contact/route.ts, lib/db.ts), and
  // this suite runs twice per invocation (the desktop and mobile Playwright
  // projects each run this test), so a real submission here wrote two live
  // rows to production on every single test run, twice more on every retry.
  // The ledger records two rounds of manual row cleanup as evidence
  // (.superpowers/sdd/2026-07-27-personal-website-foundation/progress.md).
  //
  // Chosen over the other two options considered: a test-only server path
  // would need its own auth/env split to keep it out of production, and
  // self-cleanup (delete-after-insert) would still write to prod between
  // insert and delete, plus require DATABASE_URL in the Playwright process,
  // which today only the Next.js dev server loads. Mocking the network call
  // needs neither, and the server side of the route (persist-before-send
  // ordering, honeypot handling, rate limiting, malformed-JSON and
  // oversized-body rejection, error paths) already has real coverage
  // without touching a database, in tests/contact-route.test.ts, which
  // mocks lib/db and lib/contact/mailer directly. What this e2e test alone
  // can prove is the client half: filling the real form fields, clicking
  // the real Send button, and the request/response contract the client
  // code depends on, ending in the real success UI.
  let requestBody: unknown = null
  await page.route('**/api/contact', async (route) => {
    requestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.getByLabel('Name').fill('Playwright')
  await page.getByLabel('Email').fill('playwright@example.com')
  await page.getByLabel('Message').fill('Automated test message.')
  await page.getByRole('button', { name: 'Send' }).click()

  await expect(page.getByText('Got it. I will get back to you.')).toBeVisible()
  expect(requestBody).toMatchObject({
    name: 'Playwright',
    email: 'playwright@example.com',
    body: 'Automated test message.',
  })
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
//
// toBeVisible() alone has a second, separate hole: Playwright's visibility
// predicate is a non-empty bounding box plus not `visibility:hidden`, and it
// explicitly ignores `opacity`. An element at `opacity:0` reports as visible
// under toBeVisible(). That is exactly the shape of the bug this test also
// now guards against (see the Reveal-wrapped-content test below), so every
// element checked here has its computed opacity read and asserted
// separately, not inferred from toBeVisible().
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
    const { clipPath, opacity } = await heading.evaluate((el) => {
      const ink = el.querySelector('.write-ink')
      if (!ink) throw new Error('".write-ink" not found inside heading; selector may have changed')
      const style = getComputedStyle(ink)
      return { clipPath: style.clipPath, opacity: style.opacity }
    })
    expect(clipPath, `${name}: clip-path`).toBe('none')
    expect(opacity, `${name}: opacity`).not.toBe('0')
  }

  await context.close()
})

// Carried-forward Must Fix from the final whole-branch review: Reveal
// (components/shell/Reveal.tsx) wraps About, every product card, and both
// work tracks. Its previous framer-motion implementation server-rendered
// `style="opacity:0;transform:translateY(16px)"` on every one of those
// wrappers, so with JavaScript disabled the page showed only the hero, bare
// "Products"/"Work" headings with nothing under them, and the contact form.
// The headings test above could not have caught this: WrittenHeading and
// Reveal are different components, and the heading text itself sits inside
// the Reveal wrapper but is not the thing that was hidden (the wrapper's
// opacity was). This test reads computed opacity directly on the
// [data-reveal] wrapper for one representative element in each affected
// section, which is the exact property that regressed.
test('Reveal-wrapped body content is visible with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/')

  const jsReady = await page.evaluate(() =>
    document.documentElement.classList.contains('js-ready'),
  )
  expect(jsReady).toBe(false)

  // Checked on the [data-reveal] wrapper itself, not on a descendant of it.
  // opacity does not inherit as a computed style: getComputedStyle on a
  // child of an opacity:0 ancestor still reports '1' for that child (the
  // ancestor's opacity is a compositing effect on paint, not a cascaded
  // property value), even though the child is visually invisible. An
  // earlier draft of this test checked the About paragraph itself rather
  // than its [data-reveal] ancestor and, when verified against the real
  // regression below, silently passed anyway, exactly the kind of gap this
  // whole test exists to close.
  const targets = [
    { label: 'About', locator: page.locator('#about [data-reveal]').first() },
    { label: 'first product card', locator: page.locator('#products [data-reveal]').first() },
    { label: 'first work track entry', locator: page.locator('#work [data-reveal]').first() },
  ]

  for (const { label, locator } of targets) {
    await expect(locator, `${label}: should exist exactly once`).toHaveCount(1)

    const opacity = await locator.evaluate((el) => getComputedStyle(el).opacity)
    expect(opacity, `${label}: computed opacity`).not.toBe('0')

    // Belt and suspenders alongside the opacity check: confirms the element
    // actually paints at a nonzero size too, not merely that toBeVisible()
    // would call it visible (which, per the note above the headings test,
    // opacity alone cannot influence either way).
    const box = await locator.boundingBox()
    expect(box, `${label}: bounding box`).not.toBeNull()
    expect(box!.width, `${label}: width`).toBeGreaterThan(0)
    expect(box!.height, `${label}: height`).toBeGreaterThan(0)
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
