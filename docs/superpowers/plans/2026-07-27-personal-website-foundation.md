# Personal Website Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing Vite SPA with a server-rendered Next.js site in a field-notebook aesthetic, reading its content from Neon Postgres with a seed-file fallback, and deploy it to `bryangmills.com`.

**Architecture:** Next.js 16 App Router on Vercel. The page is a server component that reads a single JSONB content document from Neon through a `'use cache'`-tagged function, falling back to a checked-in seed file when the database is unreachable. The visual system is Tailwind v4 CSS-first tokens over a paper-and-graph-grid shell. Content editing (auth, save API, inline `contentEditable`) is deliberately out of scope and lands in Plan 2; this plan's content changes by editing `seed/content.json`.

**Tech Stack:** Next.js 16.2.12, React 19.2.8, Tailwind CSS 4.3.3, motion 12.42.2, @neondatabase/serverless 1.1.0, zod 4.4.3, resend 6.18.0, roughjs 4.6.6, @phosphor-icons/react 2.1.10, Vitest 4.1.10, Playwright 1.62.0.

## Global Constraints

- **Never use em dashes** (U+2014) in any file: code, comments, copy, commit messages, docs. Use commas, colons, parentheses, or separate sentences.
- **Mobile is required, not optional.** Every page must render at 390x844 with zero horizontal overflow. Verify over CDP with `Emulation.setDeviceMetricsOverride({width:390,height:844,deviceScaleFactor:2,mobile:true})`, never with a narrow desktop window (headless Chrome enforces a ~500px minimum layout viewport and produces false overflow).
- **Tap targets are at least 44px.**
- **No external CDN requests.** Fonts are self-hosted through `next/font`, icons ship as static local SVG.
- **Card rotation is at most 1.5 degrees** and resolves to `0deg` at the `sm` breakpoint via the `--rotate` custom property.
- **All motion is disabled under `prefers-reduced-motion`.**
- **Every foreground/background colour pairing must meet WCAG AA** (4.5:1 for text under 18.66px, 3:1 above). Pencil is `#6B7683`, never the earlier `#8A939E`.
- **Secrets never enter git.** `.env.local` is gitignored and stays that way.
- **Node 24, npm 11.** TypeScript throughout, `strict: true`.

## Reference

Design spec: `docs/superpowers/specs/2026-07-27-personal-website-design.md`. Read it before Task 1.

---

## File Structure

```
app/
  layout.tsx              Root layout: fonts, metadata, paper background, nav, footer
  page.tsx                Home page: reads content, composes sections
  globals.css             Tailwind import, @theme tokens, base styles
  not-found.tsx           404 as a notebook page
  error.tsx               500 as a notebook page
  api/contact/route.ts    Contact form endpoint
components/
  shell/PaperBackground.tsx   Fixed graph grid + margin rule (decorative, aria-hidden)
  shell/Nav.tsx               Sticky nav, Caveat wordmark
  shell/Footer.tsx            Social links, copyright
  shell/TapedCard.tsx         White card with tape strip and bounded rotation
  shell/Stamp.tsx             Rotated rubber stamp
  shell/MarginNote.tsx        Handwritten margin annotation
  shell/Highlight.tsx         Highlighter stroke behind inline text
  shell/Reveal.tsx            Scroll-reveal wrapper honouring reduced motion
  sections/Hero.tsx
  sections/About.tsx
  sections/Products.tsx
  sections/Tracks.tsx
  sections/Contact.tsx
  ContactForm.tsx             Client component, the only interactive piece in Plan 1
lib/
  content/schema.ts       Zod schema for the content document, plus inferred types
  content/paths.ts        Allowlist of editable dot-paths derived from the schema
  content/read.ts         getContent(): cached DB read with seed fallback
  db.ts                   Neon client
  contact/rateLimit.ts    IP-hash rate limiting against the messages table
  contact/mailer.ts       Resend in production, console in development
seed/content.json         Starting content AND the runtime fallback
db/migrations/001_init.sql
scripts/migrate.mjs       Applies migrations in order, idempotent
scripts/build-icons.mjs   Phosphor SVG -> RoughJS -> public/icons/*.svg
scripts/check-mobile.mjs  CDP overflow assertion
tests/                    Vitest unit and integration tests
e2e/                      Playwright specs
```

Each `lib/content/*` file has one job. `schema.ts` defines shape, `paths.ts` defines what is writable (this becomes security-critical in Plan 2, so it is built and tested now), and `read.ts` defines how content is fetched. Keeping them separate means Plan 2's save API can import `paths.ts` without dragging in caching logic.

---

## Task 1: Replace Vite with Next.js 16

**Files:**
- Delete: `index.html`, `vite.config.js`, `postcss.config.js`, `eslint.config.js`, `src/`, `public/.nojekyll`, `dist/`
- Modify: `package.json`, `.gitignore`
- Create: `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `vitest.config.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a running Next.js dev server on port 3000 and a passing `npm test`.

The old `src/` is deleted rather than migrated. Its content is stale (State of Colorado framing, Brewery Finder, percentage skill bars) and every component is being replaced. The design spec's non-goals list what is intentionally dropped. Git history preserves the old code.

- [ ] **Step 1: Remove the Vite app and its dependencies**

```bash
cd ~/repos/personal_website
git rm -r --cached dist >/dev/null 2>&1 || true
rm -rf src dist public/.nojekyll index.html vite.config.js postcss.config.js eslint.config.js node_modules package-lock.json
```

- [ ] **Step 2: Write the new package.json**

```json
{
  "name": "bryan-mills-personal-website",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "npm run icons && next build",
    "start": "next start",
    "icons": "node scripts/build-icons.mjs",
    "migrate": "node scripts/migrate.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "check:mobile": "node scripts/check-mobile.mjs"
  },
  "dependencies": {
    "@neondatabase/serverless": "1.1.0",
    "motion": "12.42.2",
    "next": "16.2.12",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "resend": "6.18.0",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@phosphor-icons/core": "2.1.1",
    "@playwright/test": "1.62.0",
    "@tailwindcss/postcss": "4.3.3",
    "@types/node": "24.13.3",
    "@types/react": "19.2.8",
    "@types/react-dom": "19.2.8",
    "tailwindcss": "4.3.3",
    "typescript": "5.9.3",
    "vitest": "4.1.10"
  }
}
```

Three version notes, all verified on 2026-07-27:

- `@phosphor-icons/core` (verified present at `2.1.1`), not `@phosphor-icons/react`. Icons are converted to static SVG at build time by `scripts/build-icons.mjs`, so no icon library reaches the browser bundle.
- `@types/node` is pinned to the **24.x** line to match Node 24. Do not run `npm i -D @types/node@latest`: that resolves to 26.x and will type-check against a Node runtime you are not using.
- TypeScript is pinned to **5.9.3 deliberately**. The `latest` tag is now 7.0.2, a major rewrite, and pinning a brand-new compiler major under a brand-new Next.js major is two unknowns at once. Upgrade it as its own change, after the site is live and green.
- `roughjs` is **not** a dependency. See Task 5 for why the sketching is done with an SVG filter instead.

- [ ] **Step 3: Install and verify**

```bash
npm install
npx next --version
```

Expected: prints `Next.js v16.2.12`.

- [ ] **Step 4: Create the config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required for the 'use cache' directive and cacheTag used by lib/content/read.ts
  cacheComponents: true,
}

export default nextConfig
```

`postcss.config.mjs`:
```js
export default {
  plugins: { '@tailwindcss/postcss': {} },
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

- [ ] **Step 5: Write the failing smoke test**

`tests/smoke.test.ts`:
```ts
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
```

- [ ] **Step 6: Run the test**

Run: `npm test`
Expected: PASS, 2 tests. If `next.config.ts` does not yet exist the second test fails with ENOENT, which tells you Step 4 was skipped.

- [ ] **Step 7: Create the minimal app**

`app/globals.css`:
```css
@import "tailwindcss";
```

`app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bryan G. Mills',
  description: 'Geologist-in-Training for the State of Colorado and founder of TerminaLLM LLC.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

`app/page.tsx`:
```tsx
export default function Home() {
  return <main>Notebook coming.</main>
}
```

- [ ] **Step 8: Verify the dev server boots**

Run: `npm run dev`
Expected: `Ready` on http://localhost:3000, and the page shows "Notebook coming." with no console errors. Stop the server.

- [ ] **Step 9: Verify the production build succeeds**

Run: `npm run build -- --no-lint 2>&1 | tail -20`

The `icons` script does not exist yet, so run `npx next build` directly for this step. Expected: build completes. This catches `cacheComponents` config errors early, before there is any real code to blame.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Replace Vite SPA with Next.js 16 App Router

Server rendering is required now that content lives in a database:
a client-rendered SPA gives link-preview crawlers an empty shell."
```

---

## Task 2: Design tokens and fonts

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`
- Create: `lib/contrast.ts`, `tests/contrast.test.ts`

**Interfaces:**
- Consumes: Task 1's `app/globals.css`.
- Produces: CSS custom properties `--color-paper`, `--color-grid`, `--color-margin-rule`, `--color-ink`, `--color-graphite`, `--color-pencil`, `--color-highlighter`, `--color-stamp`, `--color-card`, `--color-card-border`, usable as Tailwind utilities (`bg-paper`, `text-ink`, and so on). Font variables `--font-display`, `--font-body`, `--font-hand`.
- Produces: `contrastRatio(hex1: string, hex2: string): number` from `lib/contrast.ts`.

The contrast test is written first because the spec caught a real failure here: the original pencil grey measured near 3:1 and failed AA for small text. A test locks that fix in permanently.

- [ ] **Step 1: Write the failing contrast test**

`tests/contrast.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { contrastRatio } from '@/lib/contrast'

const PAPER = '#FBFAF5'
const CARD = '#FFFFFF'

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
  })
  it('returns 1 for a colour against itself', () => {
    expect(contrastRatio('#16305C', '#16305C')).toBeCloseTo(1, 5)
  })
})

describe('palette meets WCAG AA', () => {
  it('ink on paper passes for body text', () => {
    expect(contrastRatio('#16305C', PAPER)).toBeGreaterThanOrEqual(4.5)
  })
  it('graphite on paper passes for body text', () => {
    expect(contrastRatio('#4A5560', PAPER)).toBeGreaterThanOrEqual(4.5)
  })
  it('pencil on paper passes for small text', () => {
    expect(contrastRatio('#6B7683', PAPER)).toBeGreaterThanOrEqual(4.5)
  })
  it('pencil on card passes for small text', () => {
    expect(contrastRatio('#6B7683', CARD)).toBeGreaterThanOrEqual(4.5)
  })
  it('stamp on paper passes for large text and UI', () => {
    expect(contrastRatio('#B4453C', PAPER)).toBeGreaterThanOrEqual(3)
  })
  it('rejects the original pencil grey that failed AA', () => {
    expect(contrastRatio('#8A939E', PAPER)).toBeLessThan(4.5)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/contrast.test.ts`
Expected: FAIL, cannot resolve `@/lib/contrast`.

- [ ] **Step 3: Implement contrastRatio**

`lib/contrast.ts`:
```ts
function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/contrast.test.ts`
Expected: PASS, 8 tests. If "pencil on card" fails, darken `#6B7683` further and update both the test and the palette; white is a harsher background than paper.

- [ ] **Step 5: Define the theme tokens**

`app/globals.css`:
```css
@import "tailwindcss";

@theme {
  --color-paper: #FBFAF5;
  --color-grid: #CBD7DD;
  --color-margin-rule: #E8A6A6;
  --color-ink: #16305C;
  --color-graphite: #4A5560;
  --color-pencil: #6B7683;
  --color-highlighter: #F2DC96;
  --color-stamp: #B4453C;
  --color-card: #FFFFFF;
  --color-card-border: #D9E0E6;

  --font-display: var(--font-fraunces), Georgia, serif;
  --font-body: var(--font-inter), system-ui, sans-serif;
  --font-hand: var(--font-caveat), cursive;
}

:root {
  /* Bounded card rotation. Flattened on small screens by the media query below. */
  --rotate: 1.2deg;
  --rotate-alt: -1deg;
}

@media (max-width: 640px) {
  :root {
    --rotate: 0deg;
    --rotate-alt: 0deg;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

body {
  background-color: var(--color-paper);
  color: var(--color-graphite);
  font-family: var(--font-body);
  /* Long unbroken strings must never force horizontal scroll. */
  overflow-wrap: anywhere;
}

/* Skip link, visible only on focus. */
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  left: 1rem;
  top: 1rem;
  z-index: 100;
  padding: 0.5rem 1rem;
  background: var(--color-card);
  border: 2px solid var(--color-stamp);
  border-radius: 4px;
}

:focus-visible {
  outline: 2px solid var(--color-stamp);
  outline-offset: 2px;
}
```

- [ ] **Step 6: Wire the fonts**

`next/font/google` downloads and self-hosts at build time, so this satisfies the no-external-CDN constraint without manually managing woff2 files.

`app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Fraunces, Inter, Caveat } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
})
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})
const caveat = Caveat({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600'],
  variable: '--font-caveat',
})

export const metadata: Metadata = {
  title: 'Bryan G. Mills',
  description:
    'Geologist-in-Training for the State of Colorado and founder of TerminaLLM LLC, building TerminaLLM and Parolejo.',
  metadataBase: new URL('https://bryangmills.com'),
  openGraph: {
    title: 'Bryan G. Mills',
    description:
      'Geologist-in-Training for the State of Colorado and founder of TerminaLLM LLC.',
    url: 'https://bryangmills.com',
    siteName: 'Bryan G. Mills',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${caveat.variable}`}
    >
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Verify the build and fonts**

Run: `npx next build`
Expected: build succeeds. Then `npm run dev`, open http://localhost:3000, and confirm in DevTools that no request goes to `fonts.googleapis.com` or `fonts.gstatic.com`. Font files must be served from your own origin under `/_next/static/media/`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add notebook palette, fonts, and a WCAG contrast test

Locks the pencil grey fix: the original #8A939E measured under 4.5:1
on paper and failed AA for small text."
```

---

## Task 3: Content schema, seed content, and the editable-path allowlist

**Files:**
- Create: `lib/content/schema.ts`, `lib/content/paths.ts`, `seed/content.json`, `tests/schema.test.ts`, `tests/paths.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `contentSchema` (zod schema) and `type Content` from `lib/content/schema.ts`
  - `EDITABLE_PATHS: readonly string[]` and `isEditablePath(path: string): boolean` from `lib/content/paths.ts`
  - `seed/content.json`, importable and schema-valid

`isEditablePath` is the function that will stand between the content document and an attacker in Plan 2. It is built and tested now, with an explicitly hostile test suite, rather than bolted on later.

- [ ] **Step 1: Write the failing schema test**

`tests/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { contentSchema } from '@/lib/content/schema'
import seed from '@/seed/content.json'

describe('contentSchema', () => {
  it('accepts the seed document', () => {
    const result = contentSchema.safeParse(seed)
    if (!result.success) console.error(result.error.issues)
    expect(result.success).toBe(true)
  })

  it('rejects a document missing hero', () => {
    const { hero, ...rest } = seed as Record<string, unknown>
    expect(contentSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a product without a name', () => {
    const bad = structuredClone(seed) as any
    delete bad.products[0].name
    expect(contentSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects a store link that is not a URL', () => {
    const bad = structuredClone(seed) as any
    bad.products[0].links[0].url = 'not-a-url'
    expect(contentSchema.safeParse(bad).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/schema.test.ts`
Expected: FAIL, cannot resolve `@/lib/content/schema`.

- [ ] **Step 3: Write the schema**

`lib/content/schema.ts`:
```ts
import { z } from 'zod'

const linkSchema = z.object({
  label: z.string().min(1).max(60),
  url: z.url(),
})

const productSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(60),
  tagline: z.string().min(1).max(120),
  body: z.string().min(1).max(600),
  tags: z.array(z.string().min(1).max(30)).max(8),
  links: z.array(linkSchema).max(4),
})

const trackEntrySchema = z.object({
  id: z.string().min(1).max(40),
  org: z.string().min(1).max(80),
  role: z.string().min(1).max(80),
  period: z.string().min(1).max(40),
  body: z.string().max(600),
})

const trackSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(60),
  entries: z.array(trackEntrySchema).max(10),
})

export const contentSchema = z.object({
  version: z.literal(1),
  hero: z.object({
    kicker: z.string().min(1).max(80),
    name: z.string().min(1).max(60),
    lede: z.string().min(1).max(400),
    stamp: z.string().min(1).max(20),
  }),
  about: z.object({
    heading: z.string().min(1).max(80),
    paragraphs: z.array(z.string().min(1).max(800)).min(1).max(5),
    marginNote: z.string().max(80),
  }),
  products: z.array(productSchema).max(6),
  tracks: z.array(trackSchema).max(3),
  contact: z.object({
    heading: z.string().min(1).max(80),
    blurb: z.string().max(400),
  }),
  footer: z.object({
    note: z.string().max(120),
    links: z.array(linkSchema).max(6),
  }),
})

export type Content = z.infer<typeof contentSchema>
```

Verified on 2026-07-27 against zod 4.4.3: both the top-level `z.url()` used here and the older `z.string().url()` exist and work. No fallback needed.

- [ ] **Step 4: Write the seed content**

`seed/content.json`. Copy comes from the design spec and from the live product sites. `EST. 2026` is confirmed correct; TerminaLLM LLC was formed in 2026.

```json
{
  "version": 1,
  "hero": {
    "kicker": "Entry 001 · Denver, Colorado",
    "name": "Bryan G. Mills",
    "lede": "Geologist-in-Training for the State of Colorado. Founder of TerminaLLM LLC, where I build TerminaLLM and Parolejo.",
    "stamp": "EST. 2026"
  },
  "about": {
    "heading": "Two careers, one set of tools",
    "paragraphs": [
      "I spend my days on two problems that look unrelated and are not. One is what moves through the ground, and how fast, and whether anyone should be worried about it. The other is what should happen when a developer opens a terminal on their phone.",
      "For the State of Colorado I work as a Geologist-in-Training: contaminant transport, trend analysis on volatile organic compounds, and the data tooling that turns field measurements into something a regulator can act on.",
      "Through TerminaLLM LLC I design and ship software end to end. TerminaLLM puts a real terminal and a fleet of AI coding agents in your pocket. Parolejo teaches Esperanto entirely offline, with no ads, no accounts, and no tracking. Both are on the App Store and Google Play."
    ],
    "marginNote": "geology taught me to distrust a single sample"
  },
  "products": [
    {
      "id": "terminallm",
      "name": "TerminaLLM",
      "tagline": "Your command-line AI, in your pocket",
      "body": "An SSH terminal for iOS and Android with AI coding agents built in. Full xterm-256color with an AI-optimized keyboard, six workspaces, and a Swarm mode that runs multiple agents at once in separate panes. SFTP browsing with in-place editing, port forwarding to your local dev server, and sessions that survive disconnects and network handoffs.",
      "tags": ["iOS", "Android", "SSH", "AI agents"],
      "links": [
        { "label": "terminallm.app", "url": "https://terminallm.app" }
      ]
    },
    {
      "id": "parolejo",
      "name": "Parolejo",
      "tagline": "Saluton! Lernu Esperanton.",
      "body": "A fully offline Esperanto course for iOS and Android. Twelve Zagreb-method lessons with narrator audio and adjustable playback, flashcard drills, and the 63,000-word ESPDIC dictionary bundled in. Works with no connection at all. Free, no ads, no accounts, no tracking.",
      "tags": ["iOS", "Android", "Offline", "Esperanto"],
      "links": [
        { "label": "parolejo.app", "url": "https://parolejo.app" }
      ]
    }
  ],
  "tracks": [
    {
      "id": "science",
      "label": "Track 01 / Science",
      "entries": [
        {
          "id": "colorado",
          "org": "State of Colorado",
          "role": "Geologist-in-Training",
          "period": "Present",
          "body": "Contaminant transport modeling, Mann-Kendall trend analysis on VOC monitoring data, and internal tooling that moves field data into something usable."
        }
      ]
    },
    {
      "id": "software",
      "label": "Track 02 / Software",
      "entries": [
        {
          "id": "terminallm-llc",
          "org": "TerminaLLM LLC",
          "role": "Owner and lead developer",
          "period": "Present",
          "body": "Founded 2026. Design, build, ship, and support two mobile products across iOS and Android, plus everything behind them."
        }
      ]
    }
  ],
  "contact": {
    "heading": "Get in touch",
    "blurb": "Open to interesting problems, especially where earth science and software meet."
  },
  "footer": {
    "note": "Built in Colorado.",
    "links": [
      { "label": "GitHub", "url": "https://github.com/bmills23/" },
      { "label": "LinkedIn", "url": "https://www.linkedin.com/in/bryangmills/" }
    ]
  }
}
```

- [ ] **Step 5: Run the schema test**

Run: `npx vitest run tests/schema.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Write the failing allowlist test**

`tests/paths.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isEditablePath, EDITABLE_PATHS } from '@/lib/content/paths'

describe('isEditablePath: allows real fields', () => {
  it.each([
    'hero.name',
    'hero.lede',
    'hero.kicker',
    'hero.stamp',
    'about.heading',
    'about.marginNote',
    'about.paragraphs.0',
    'about.paragraphs.2',
    'products.0.name',
    'products.1.body',
    'products.0.tags.3',
    'products.0.links.0.url',
    'tracks.0.entries.0.role',
    'contact.blurb',
    'footer.links.1.label',
  ])('allows %s', (path) => {
    expect(isEditablePath(path)).toBe(true)
  })
})

describe('isEditablePath: rejects everything else', () => {
  it.each([
    ['unknown top-level key', 'admin.isAdmin'],
    ['unknown leaf', 'hero.password'],
    ['the version field', 'version'],
    ['a whole object', 'hero'],
    ['a whole array', 'products'],
    ['prototype pollution', '__proto__.polluted'],
    ['constructor', 'constructor.prototype.x'],
    ['prototype segment mid-path', 'hero.__proto__.x'],
    ['negative index', 'products.-1.name'],
    ['non-numeric index', 'products.abc.name'],
    ['float index', 'products.1.5.name'],
    ['index beyond the schema max', 'products.99.name'],
    ['empty string', ''],
    ['trailing dot', 'hero.name.'],
    ['leading dot', '.hero.name'],
    ['double dot', 'hero..name'],
    ['whitespace', 'hero.name '],
    ['sql-ish', "hero.name'; drop table content;--"],
    ['path traversal', '../../etc/passwd'],
    ['deeply nested nonsense', 'a.b.c.d.e.f.g'],
  ])('rejects %s', (_label, path) => {
    expect(isEditablePath(path)).toBe(false)
  })
})

describe('EDITABLE_PATHS', () => {
  it('is non-empty', () => {
    expect(EDITABLE_PATHS.length).toBeGreaterThan(10)
  })
  it('contains no duplicates', () => {
    expect(new Set(EDITABLE_PATHS).size).toBe(EDITABLE_PATHS.length)
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run tests/paths.test.ts`
Expected: FAIL, cannot resolve `@/lib/content/paths`.

- [ ] **Step 8: Implement the allowlist**

The allowlist is a set of path *patterns* where `#` stands for an array index. Only string leaves are editable; objects and arrays are not, since structural changes go through dedicated array operations in Plan 2.

`lib/content/paths.ts`:
```ts
/**
 * Editable path patterns. '#' matches a single non-negative integer index.
 * Only string leaves appear here. Structural edits (adding or removing a
 * product, reordering entries) are separate operations, not path writes.
 */
export const EDITABLE_PATTERNS = [
  'hero.kicker',
  'hero.name',
  'hero.lede',
  'hero.stamp',
  'about.heading',
  'about.marginNote',
  'about.paragraphs.#',
  'products.#.name',
  'products.#.tagline',
  'products.#.body',
  'products.#.tags.#',
  'products.#.links.#.label',
  'products.#.links.#.url',
  'tracks.#.label',
  'tracks.#.entries.#.org',
  'tracks.#.entries.#.role',
  'tracks.#.entries.#.period',
  'tracks.#.entries.#.body',
  'contact.heading',
  'contact.blurb',
  'footer.note',
  'footer.links.#.label',
  'footer.links.#.url',
] as const

/** Upper bound on any array index, matching the schema's generous max array sizes. */
const MAX_INDEX = 20

const INDEX_RE = /^(0|[1-9][0-9]?)$/

function isIndex(segment: string): boolean {
  return INDEX_RE.test(segment) && Number(segment) <= MAX_INDEX
}

export function isEditablePath(path: string): boolean {
  if (typeof path !== 'string' || path.length === 0 || path.length > 120) return false
  // Reject anything that is not plain lowercase-ish identifiers, digits, and dots.
  if (!/^[A-Za-z0-9.]+$/.test(path)) return false
  if (path.startsWith('.') || path.endsWith('.') || path.includes('..')) return false

  const segments = path.split('.')
  if (segments.some((s) => s === '__proto__' || s === 'constructor' || s === 'prototype')) {
    return false
  }

  return EDITABLE_PATTERNS.some((pattern) => {
    const parts = pattern.split('.')
    if (parts.length !== segments.length) return false
    return parts.every((part, i) => (part === '#' ? isIndex(segments[i]) : part === segments[i]))
  })
}

/** Concrete paths for a given document, used by the UI to know what is editable. */
export const EDITABLE_PATHS: readonly string[] = EDITABLE_PATTERNS
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run tests/paths.test.ts`
Expected: PASS, all cases. The `products.1.5.name` case passes because `1.5` splits into segments `1` and `5`, producing a 4-segment path that matches no 3-segment pattern.

- [ ] **Step 10: Run the full suite and commit**

```bash
npm test
git add -A
git commit -m "Add content schema, seed document, and editable-path allowlist

The allowlist is the boundary between the content document and an
attacker once the save API lands, so it ships with a hostile test
suite covering prototype pollution, index abuse, and malformed paths."
```

---

## Task 4: Database migration and the content read path

**Files:**
- Create: `db/migrations/001_init.sql`, `scripts/migrate.mjs`, `lib/db.ts`, `lib/content/read.ts`, `tests/read.test.ts`
- Modify: none

**Interfaces:**
- Consumes: `contentSchema`, `Content` from Task 3.
- Produces:
  - `sql` (Neon tagged-template client) from `lib/db.ts`
  - `getContent(): Promise<Content>` from `lib/content/read.ts`, cached under the tag `content`
  - `readContentUncached(): Promise<Content>` from `lib/content/read.ts`, exported for tests
  - Tables `content`, `content_history`, `messages` in Neon

- [ ] **Step 1: Write the migration**

`db/migrations/001_init.sql`:
```sql
create table if not exists content (
  id         int primary key default 1,
  doc        jsonb not null,
  updated_at timestamptz not null default now(),
  constraint content_singleton check (id = 1)
);

create table if not exists content_history (
  id       bigserial primary key,
  doc      jsonb not null,
  saved_at timestamptz not null default now()
);

create table if not exists messages (
  id         bigserial primary key,
  name       text not null,
  email      text not null,
  body       text not null,
  ip_hash    text,
  created_at timestamptz not null default now()
);

create index if not exists messages_ip_recent
  on messages (ip_hash, created_at desc);

create table if not exists schema_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);
```

- [ ] **Step 2: Write the migration runner**

`scripts/migrate.mjs`:
```js
import { neon } from '@neondatabase/serverless'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Load .env.local first.')
  process.exit(1)
}

const sql = neon(url)
await sql`create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
)`

const dir = join(process.cwd(), 'db', 'migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const applied = new Set((await sql`select name from schema_migrations`).map((r) => r.name))

for (const file of files) {
  if (applied.has(file)) {
    console.log(`skip  ${file}`)
    continue
  }
  const body = readFileSync(join(dir, file), 'utf8')
  // Neon's HTTP driver runs one statement per call, so split on semicolons at
  // statement boundaries. These migrations contain no semicolons inside literals.
  for (const statement of body.split(';').map((s) => s.trim()).filter(Boolean)) {
    await sql.query(statement)
  }
  await sql`insert into schema_migrations (name) values (${file})`
  console.log(`apply ${file}`)
}
console.log('migrations up to date')
```

- [ ] **Step 3: Apply the migration**

```bash
set -a && source .env.local && set +a && npm run migrate
```

Expected: `apply 001_init.sql` then `migrations up to date`. Re-running prints `skip 001_init.sql`, proving idempotence. If the second run applies anything again, fix the runner before continuing.

- [ ] **Step 4: Seed the content row**

```bash
set -a && source .env.local && set +a && node -e '
import("@neondatabase/serverless").then(async ({ neon }) => {
  const { readFileSync } = await import("node:fs")
  const sql = neon(process.env.DATABASE_URL)
  const doc = readFileSync("seed/content.json", "utf8")
  await sql`insert into content (id, doc) values (1, ${doc}::jsonb)
            on conflict (id) do update set doc = excluded.doc, updated_at = now()`
  const [row] = await sql`select jsonb_extract_path_text(doc, ${"hero"}, ${"name"}) as name from content where id = 1`
  console.log("seeded:", row.name)
})'
```

Expected: `seeded: Bryan G. Mills`.

- [ ] **Step 5: Write the failing read test**

`tests/read.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readContentUncached } from '@/lib/content/read'
import { contentSchema } from '@/lib/content/schema'

describe('readContentUncached', () => {
  it('returns a schema-valid document from the database', async () => {
    const content = await readContentUncached()
    expect(contentSchema.safeParse(content).success).toBe(true)
    expect(content.hero.name).toBe('Bryan G. Mills')
  })

  it('falls back to the seed when the database is unreachable', async () => {
    const original = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'postgresql://nobody:nothing@127.0.0.1:1/none'
    try {
      const content = await readContentUncached()
      expect(content.hero.name).toBe('Bryan G. Mills')
      expect(content.version).toBe(1)
    } finally {
      process.env.DATABASE_URL = original
    }
  }, 20000)
})
```

This test needs `DATABASE_URL`. Add to `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

`tests/setup.ts`:
```ts
import { readFileSync, existsSync } from 'node:fs'

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/read.test.ts`
Expected: FAIL, cannot resolve `@/lib/content/read`.

- [ ] **Step 7: Implement the database client and read path**

`lib/db.ts`:
```ts
import { neon } from '@neondatabase/serverless'

export function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  // Constructed per call so tests can swap the URL at runtime.
  return neon(url)
}
```

`lib/content/read.ts`:
```ts
import { cacheTag } from 'next/cache'
import { getSql } from '@/lib/db'
import { contentSchema, type Content } from '@/lib/content/schema'
import seed from '@/seed/content.json'

const SEED = contentSchema.parse(seed)

/**
 * Reads the content document straight from Postgres, falling back to the
 * checked-in seed if the database is unreachable or holds an invalid document.
 * The site staying up through a database incident is worth these few lines.
 */
export async function readContentUncached(): Promise<Content> {
  try {
    const sql = getSql()
    const rows = await sql`select doc from content where id = 1`
    if (rows.length === 0) return SEED
    const parsed = contentSchema.safeParse(rows[0].doc)
    if (!parsed.success) {
      console.error('content document failed validation, serving seed', parsed.error.issues)
      return SEED
    }
    return parsed.data
  } catch (error) {
    console.error('content read failed, serving seed', error)
    return SEED
  }
}

export async function getContent(): Promise<Content> {
  'use cache'
  cacheTag('content')
  return readContentUncached()
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run tests/read.test.ts`
Expected: PASS, 2 tests. The fallback test may take several seconds while the bad connection times out.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add schema migration, Neon client, and cached content read

The read falls back to seed/content.json on any database failure so a
Neon incident degrades to stale content rather than a blank site."
```

---

## Task 5: Sketched icon build step

**Files:**
- Create: `scripts/build-icons.mjs`, `components/Icon.tsx`, `tests/icons.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: `public/icons/<name>.svg` for each icon in `ICONS`, and `<Icon name="..." />` from `components/Icon.tsx`.

Icons are roughened at build time, so the browser gets plain static SVG. RoughJS never reaches the client bundle.

- [ ] **Step 1: Write the failing test**

`tests/icons.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { ICONS } from '@/scripts/icon-list.mjs'

describe('sketched icons', () => {
  it('declares at least one icon', () => {
    expect(ICONS.length).toBeGreaterThan(0)
  })

  it('generates an svg for every declared icon', () => {
    for (const name of ICONS) {
      const path = `public/icons/${name}.svg`
      expect(existsSync(path), `${path} missing, run: npm run icons`).toBe(true)
      const svg = readFileSync(path, 'utf8')
      expect(svg).toContain('<svg')
      expect(svg).toContain('currentColor')
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/icons.test.ts`
Expected: FAIL, cannot resolve the icon list.

- [ ] **Step 3: Declare the icon list**

`scripts/icon-list.mjs`:
```js
/** Phosphor icon names used on the site. Brand marks are NOT here: GitHub,
 *  LinkedIn, App Store, and Play stay in their official unsketched form. */
export const ICONS = ['arrow-up-right', 'envelope-simple', 'map-pin', 'terminal-window', 'translate']
```

- [ ] **Step 4: Write the build script**

`scripts/build-icons.mjs`:
```js
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ICONS } from './icon-list.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'icons')
mkdirSync(out, { recursive: true })

// Phosphor ships raw SVG in @phosphor-icons/core under assets/<weight>/<name>.svg
const source = join(root, 'node_modules', '@phosphor-icons', 'core', 'assets', 'regular')

for (const name of ICONS) {
  const file = join(source, `${name}.svg`)
  if (!existsSync(file)) {
    console.error(`missing phosphor icon: ${name} (looked in ${file})`)
    process.exit(1)
  }
  const raw = readFileSync(file, 'utf8')
  writeFileSync(join(out, `${name}.svg`), roughen(raw))
  console.log(`icon  ${name}`)
}

/**
 * Applies a hand-drawn treatment. Phosphor icons are filled paths, so rather
 * than re-stroking them through RoughJS's canvas API (which needs a DOM), we
 * convert to an outlined stroke with a slight jitter filter. This keeps the
 * build dependency-light and deterministic.
 */
function roughen(svg) {
  const filter = `<filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="0.7" xChannelSelector="R" yChannelSelector="G"/></filter>`
  return svg
    .replace(/fill="#[0-9a-fA-F]{3,6}"/g, 'fill="currentColor"')
    .replace(/<svg([^>]*)>/, `<svg$1><defs>${filter}</defs><g filter="url(#rough)">`)
    .replace('</svg>', '</g></svg>')
    .replace(/<svg(?![^>]*fill=)([^>]*)>/, '<svg$1 fill="currentColor">')
}
```

The `roughen` implementation uses an SVG displacement filter rather than RoughJS, because RoughJS renders to canvas or needs a DOM, and pulling `jsdom` into the build for five icons is not worth it. The visual result (a wobbling, hand-drawn edge) is what the design calls for. If the wobble reads wrong at 20px, tune `baseFrequency` (higher is tighter) and `scale` (higher is wobblier), then re-run `npm run icons` and look again. Remove `roughjs` from `package.json` if this approach is kept.

- [ ] **Step 5: Generate the icons and run the test**

Run: `npm run icons && npx vitest run tests/icons.test.ts`
Expected: five `icon <name>` lines, then PASS. If Phosphor's asset path differs, run `ls node_modules/@phosphor-icons/core/assets/` and correct `source`.

- [ ] **Step 6: Create the Icon component**

`components/Icon.tsx`:
```tsx
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Server component: inlines the pre-sketched SVG so it inherits currentColor. */
export function Icon({
  name,
  size = 20,
  className = '',
}: {
  name: string
  size?: number
  className?: string
}) {
  const svg = readFileSync(join(process.cwd(), 'public', 'icons', `${name}.svg`), 'utf8')
    .replace(/width="[^"]*"/, `width="${size}"`)
    .replace(/height="[^"]*"/, `height="${size}"`)
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-flex' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
```

`dangerouslySetInnerHTML` is safe here: the input is a build-generated file from a pinned dependency, never user content.

- [ ] **Step 7: Commit**

Add `public/icons/` to git (generated but committed, so a deploy never depends on the build step ordering):

```bash
git add -A
git commit -m "Add build-time sketched icon pipeline

Icons are roughened at build time and ship as static SVG, so no
sketching library reaches the client bundle."
```

---

## Task 6: The notebook shell

**Files:**
- Create: `components/shell/PaperBackground.tsx`, `components/shell/Nav.tsx`, `components/shell/Footer.tsx`, `components/shell/TapedCard.tsx`, `components/shell/Stamp.tsx`, `components/shell/MarginNote.tsx`, `components/shell/Highlight.tsx`, `components/shell/Reveal.tsx`, `scripts/check-mobile.mjs`
- Modify: `app/layout.tsx`, `app/page.tsx`

**Interfaces:**
- Consumes: theme tokens from Task 2, `getContent` from Task 4.
- Produces:
  - `<PaperBackground />`
  - `<Nav links={{label, href}[]} />`
  - `<Footer note={string} links={{label,url}[]} />`
  - `<TapedCard alt?: boolean className?: string>{children}</TapedCard>`
  - `<Stamp>{text}</Stamp>`
  - `<MarginNote>{text}</MarginNote>`
  - `<Highlight>{children}</Highlight>`
  - `<Reveal delay?: number>{children}</Reveal>`

- [ ] **Step 1: Build the decorative layer**

`components/shell/PaperBackground.tsx`:
```tsx
export function PaperBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-grid) 1px, transparent 1px), linear-gradient(90deg, var(--color-grid) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />
      <div className="absolute inset-y-0 left-10 w-px bg-margin-rule opacity-60 sm:left-16" />
    </div>
  )
}
```

- [ ] **Step 2: Build the notebook primitives**

`components/shell/TapedCard.tsx`:
```tsx
export function TapedCard({
  children,
  alt = false,
  className = '',
}: {
  children: React.ReactNode
  alt?: boolean
  className?: string
}) {
  return (
    <div
      className={`relative rounded-sm border border-card-border bg-card p-5 shadow-[2px_3px_0_rgba(32,36,43,0.07)] sm:p-6 ${className}`}
      style={{ transform: `rotate(var(${alt ? '--rotate-alt' : '--rotate'}))` }}
    >
      <span
        aria-hidden="true"
        className="absolute -top-3 left-8 h-4 w-14 bg-highlighter/60"
        style={{ transform: `rotate(var(${alt ? '--rotate' : '--rotate-alt'}))` }}
      />
      {children}
    </div>
  )
}
```

`components/shell/Stamp.tsx`:
```tsx
export function Stamp({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block rounded-sm border-2 border-stamp px-2.5 py-1.5 font-body text-[10px] tracking-[0.16em] text-stamp opacity-80"
      style={{ transform: 'rotate(6deg)' }}
    >
      {children}
    </span>
  )
}
```

`components/shell/MarginNote.tsx`:
```tsx
export function MarginNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-hand text-lg text-pencil"
      style={{ transform: 'rotate(-2deg)' }}
    >
      {children}
    </p>
  )
}
```

`components/shell/Highlight.tsx`:
```tsx
export function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        backgroundImage:
          'linear-gradient(transparent 62%, var(--color-highlighter) 62%)',
      }}
    >
      {children}
    </span>
  )
}
```

`components/shell/Reveal.tsx`:
```tsx
'use client'

import { motion, useReducedMotion } from 'motion/react'

export function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 3: Build nav and footer**

`components/shell/Nav.tsx`:
```tsx
import Link from 'next/link'

const LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Work', href: '#work' },
  { label: 'Products', href: '#products' },
  { label: 'Contact', href: '#contact' },
]

export function Nav() {
  return (
    <nav className="sticky top-0 z-20 border-b border-card-border bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-8">
        <Link href="/" className="font-hand text-xl text-ink">
          Bryan Mills
        </Link>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-pencil">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex min-h-11 items-center hover:text-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
```

The `min-h-11` gives a 44px tap target as required by the global constraints.

`components/shell/Footer.tsx`:
```tsx
export function Footer({
  note,
  links,
}: {
  note: string
  links: { label: string; url: string }[]
}) {
  return (
    <footer className="mt-20 border-t border-card-border">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-pencil sm:px-8">
        <p>{note}</p>
        <ul className="flex gap-4">
          {links.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                className="inline-flex min-h-11 items-center hover:text-ink"
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Compose the shell**

`app/layout.tsx`, replacing the `<body>` contents:
```tsx
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <PaperBackground />
        <Nav />
        {children}
      </body>
```
with matching imports for `PaperBackground` and `Nav`.

`app/page.tsx`:
```tsx
import { getContent } from '@/lib/content/read'
import { Footer } from '@/components/shell/Footer'
import { TapedCard } from '@/components/shell/TapedCard'

export default async function Home() {
  const content = await getContent()
  return (
    <>
      <main id="main" className="mx-auto max-w-4xl px-5 pt-10 sm:px-8">
        <TapedCard>
          <h1 className="font-display text-3xl text-ink">{content.hero.name}</h1>
        </TapedCard>
      </main>
      <Footer note={content.footer.note} links={content.footer.links} />
    </>
  )
}
```

- [ ] **Step 5: Write the mobile overflow checker**

`scripts/check-mobile.mjs`:
```js
/**
 * Drives Chrome over CDP at a TRUE mobile viewport. Do not replace this with
 * a narrow window: headless Chrome enforces a ~500px minimum layout viewport
 * and reports overflow that does not exist on a real phone.
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const URL_TO_CHECK = process.env.CHECK_URL ?? 'http://localhost:3000'
const PORT = 9222
const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--no-first-run',
  '--user-data-dir=/tmp/cdp-mobile-check',
])

try {
  await sleep(1500)
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))

  let id = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (pending.has(msg.id)) {
      pending.get(msg.id)(msg.result)
      pending.delete(msg.id)
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const msgId = ++id
      pending.set(msgId, resolve)
      ws.send(JSON.stringify({ id: msgId, method, params }))
    })

  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await send('Page.enable')
  await send('Page.navigate', { url: URL_TO_CHECK })
  await sleep(3000)

  const { result } = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const w = document.documentElement.clientWidth;
      const bad = [...document.querySelectorAll('*')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > w + 0.5 || r.left < -0.5);
      }).map(el => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').slice(0,2).join('.') : ''));
      return { width: w, scrollWidth: document.documentElement.scrollWidth, count: bad.length, offenders: bad.slice(0, 10) };
    })()`,
  })

  const r = result.value
  console.log(JSON.stringify(r, null, 2))
  ws.close()

  if (r.count > 0 || r.scrollWidth > r.width + 0.5) {
    console.error(`FAIL: ${r.count} overflowing elements at 390px`)
    process.exit(1)
  }
  console.log('PASS: no horizontal overflow at 390x844')
} finally {
  chrome.kill()
}
```

- [ ] **Step 6: Run the mobile check**

```bash
npm run dev &
sleep 5
npm run check:mobile
kill %1
```

Expected: `PASS: no horizontal overflow at 390x844`. If Chrome is elsewhere, set `CHROME_PATH`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add notebook shell: paper, grid, margin rule, nav, footer, primitives

Includes a CDP mobile overflow check at a true 390x844 viewport."
```

---

## Task 7: Hero and About sections

**Files:**
- Create: `components/sections/Hero.tsx`, `components/sections/About.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Content` (Task 3), `Stamp`, `MarginNote`, `Highlight`, `Reveal` (Task 6).
- Produces: `<Hero hero={Content['hero']} />`, `<About about={Content['about']} />`

- [ ] **Step 1: Build the hero**

`components/sections/Hero.tsx`:
```tsx
import type { Content } from '@/lib/content/schema'
import { Stamp } from '@/components/shell/Stamp'
import { MarginNote } from '@/components/shell/MarginNote'

export function Hero({ hero }: { hero: Content['hero'] }) {
  return (
    <section className="relative pt-12 pb-16 sm:pt-16">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-pencil">
          {hero.kicker}
        </p>
        <Stamp>{hero.stamp}</Stamp>
      </div>
      <h1 className="font-display text-5xl leading-[1.05] text-ink sm:text-6xl">
        {hero.name}
      </h1>
      <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-graphite">
        {hero.lede}
      </p>
      <div className="mt-8">
        <MarginNote>&#8599; two careers, one set of tools</MarginNote>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Build the about section**

`components/sections/About.tsx`:
```tsx
import type { Content } from '@/lib/content/schema'
import { MarginNote } from '@/components/shell/MarginNote'
import { Reveal } from '@/components/shell/Reveal'

export function About({ about }: { about: Content['about'] }) {
  return (
    <section id="about" className="border-t border-card-border py-14">
      <Reveal>
        <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-stamp">
          About
        </p>
        <h2 className="font-display text-3xl text-ink sm:text-4xl">
          {about.heading}
        </h2>
        <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="space-y-4 text-[16px] leading-relaxed text-graphite">
            {about.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          {about.marginNote ? (
            <aside className="md:pt-2">
              <MarginNote>{about.marginNote}</MarginNote>
            </aside>
          ) : null}
        </div>
      </Reveal>
    </section>
  )
}
```

The `minmax(0,1fr)` is deliberate: a bare `1fr` grid child refuses to shrink below its content and is a common cause of mobile overflow.

- [ ] **Step 3: Compose into the page**

`app/page.tsx`:
```tsx
import { getContent } from '@/lib/content/read'
import { Hero } from '@/components/sections/Hero'
import { About } from '@/components/sections/About'
import { Footer } from '@/components/shell/Footer'

export default async function Home() {
  const content = await getContent()
  return (
    <>
      <main id="main" className="mx-auto max-w-4xl px-5 sm:px-8">
        <Hero hero={content.hero} />
        <About about={content.about} />
      </main>
      <Footer note={content.footer.note} links={content.footer.links} />
    </>
  )
}
```

- [ ] **Step 4: Verify visually and on mobile**

```bash
npm run dev &
sleep 5
npm run check:mobile
kill %1
```

Expected: PASS. Also open http://localhost:3000 and confirm the hero name renders in Fraunces, the margin note in Caveat, and the stamp sits rotated at the top right.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add hero and about sections"
```

---

## Task 8: Products and work tracks

**Files:**
- Create: `components/sections/Products.tsx`, `components/sections/Tracks.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Content`, `TapedCard`, `Reveal`, `Icon`.
- Produces: `<Products products={Content['products']} />`, `<Tracks tracks={Content['tracks']} />`

- [ ] **Step 1: Build the products section**

`components/sections/Products.tsx`:
```tsx
import type { Content } from '@/lib/content/schema'
import { TapedCard } from '@/components/shell/TapedCard'
import { Reveal } from '@/components/shell/Reveal'
import { Icon } from '@/components/Icon'

export function Products({ products }: { products: Content['products'] }) {
  return (
    <section id="products" className="border-t border-card-border py-14">
      <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-stamp">
        Shipped
      </p>
      <h2 className="font-display text-3xl text-ink sm:text-4xl">Products</h2>
      <div className="mt-8 grid gap-7 md:grid-cols-2">
        {products.map((product, i) => (
          <Reveal key={product.id} delay={i * 0.08}>
            <TapedCard alt={i % 2 === 1} className="h-full">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-mono text-lg font-semibold text-ink">
                  {product.name}
                </h3>
                <span className="text-[11px] uppercase tracking-[0.16em] text-pencil">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="mt-1 font-display text-[15px] text-graphite">
                {product.tagline}
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-graphite">
                {product.body}
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-sm border border-card-border px-2 py-1 text-[11px] text-pencil"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-card-border pt-3">
                {product.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink hover:text-stamp"
                  >
                    {link.label}
                    <Icon name="arrow-up-right" size={14} />
                  </a>
                ))}
              </div>
            </TapedCard>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Build the two-track work section**

`components/sections/Tracks.tsx`:
```tsx
import type { Content } from '@/lib/content/schema'
import { Reveal } from '@/components/shell/Reveal'

export function Tracks({ tracks }: { tracks: Content['tracks'] }) {
  return (
    <section id="work" className="border-t border-card-border py-14">
      <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-stamp">
        Two tracks, at once
      </p>
      <h2 className="font-display text-3xl text-ink sm:text-4xl">Work</h2>
      <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-0">
        {tracks.map((track, i) => (
          <Reveal key={track.id} delay={i * 0.08}>
            <div
              className={
                i === 0
                  ? 'md:border-r md:border-card-border md:pr-8'
                  : 'md:pl-8'
              }
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-pencil">
                {track.label}
              </p>
              <div className="mt-4 space-y-6">
                {track.entries.map((entry) => (
                  <div key={entry.id}>
                    <h3 className="font-display text-xl text-ink">{entry.org}</h3>
                    <p className="mt-1 text-[13px] text-pencil">
                      {entry.role} &middot; {entry.period}
                    </p>
                    {entry.body ? (
                      <p className="mt-2 text-[15px] leading-relaxed text-graphite">
                        {entry.body}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Compose into the page**

Add to `app/page.tsx` inside `<main>`, after `<About />`:
```tsx
        <Products products={content.products} />
        <Tracks tracks={content.tracks} />
```
with matching imports.

- [ ] **Step 4: Verify on mobile**

```bash
npm run dev &
sleep 5
npm run check:mobile
kill %1
```

Expected: PASS. The two-column grids must collapse to one column, and the `md:border-r` divider must disappear rather than becoming a stray line.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add products and two-track work sections"
```

---

## Task 9: Contact form

**Files:**
- Create: `lib/contact/rateLimit.ts`, `lib/contact/mailer.ts`, `app/api/contact/route.ts`, `components/ContactForm.tsx`, `components/sections/Contact.tsx`, `tests/contact.test.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getSql` (Task 4), `Content` (Task 3).
- Produces:
  - `hashIp(ip: string): string` and `isRateLimited(ipHash: string): Promise<boolean>` from `lib/contact/rateLimit.ts`
  - `sendContactEmail(input: {name, email, body}): Promise<void>` from `lib/contact/mailer.ts`
  - `contactInputSchema` from `app/api/contact/route.ts`, re-exported for tests
  - `POST /api/contact`

- [ ] **Step 1: Write the failing test**

`tests/contact.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { hashIp } from '@/lib/contact/rateLimit'
import { contactInputSchema } from '@/lib/contact/schema'

describe('hashIp', () => {
  it('is deterministic', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'))
  })
  it('differs between addresses', () => {
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('1.2.3.5'))
  })
  it('does not contain the raw address', () => {
    expect(hashIp('1.2.3.4')).not.toContain('1.2.3.4')
  })
})

describe('contactInputSchema', () => {
  const valid = { name: 'Ada', email: 'ada@example.com', body: 'Hello there.', website: '' }

  it('accepts a valid submission', () => {
    expect(contactInputSchema.safeParse(valid).success).toBe(true)
  })
  it('rejects a bad email', () => {
    expect(contactInputSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false)
  })
  it('rejects an empty body', () => {
    expect(contactInputSchema.safeParse({ ...valid, body: '' }).success).toBe(false)
  })
  it('rejects an over-long body', () => {
    expect(contactInputSchema.safeParse({ ...valid, body: 'x'.repeat(5001) }).success).toBe(false)
  })
  it('rejects a filled honeypot', () => {
    expect(contactInputSchema.safeParse({ ...valid, website: 'http://spam' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/contact.test.ts`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Implement the schema, rate limiter, and mailer**

`lib/contact/schema.ts`:
```ts
import { z } from 'zod'

export const contactInputSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  body: z.string().min(1).max(5000),
  // Honeypot: a real person never fills this, it is hidden from view.
  website: z.string().max(0),
})

export type ContactInput = z.infer<typeof contactInputSchema>
```

`lib/contact/rateLimit.ts`:
```ts
import { createHash } from 'node:crypto'
import { getSql } from '@/lib/db'

const WINDOW_MINUTES = 60
const MAX_PER_WINDOW = 5

export function hashIp(ip: string): string {
  const salt = process.env.AUTH_SECRET ?? 'unsalted'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

export async function isRateLimited(ipHash: string): Promise<boolean> {
  try {
    const sql = getSql()
    const rows = await sql`
      select count(*)::int as n from messages
      where ip_hash = ${ipHash}
        and created_at > now() - interval '${WINDOW_MINUTES} minutes'`
    return rows[0].n >= MAX_PER_WINDOW
  } catch {
    // A database failure must not silently disable the limiter, but it also
    // must not block a legitimate sender. Fail closed on the limiter only.
    return false
  }
}
```

If Neon rejects the interpolated interval, replace with `now() - make_interval(mins => ${WINDOW_MINUTES})`.

`lib/contact/mailer.ts`:
```ts
import { Resend } from 'resend'
import type { ContactInput } from '@/lib/contact/schema'

export async function sendContactEmail(input: ContactInput): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const to = process.env.CONTACT_TO_EMAIL

  if (!key || !to) {
    console.log('[contact] no Resend config, printing instead:\n', input)
    return
  }

  const resend = new Resend(key)
  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to,
    replyTo: input.email,
    subject: `bryangmills.com: ${input.name}`,
    text: `From: ${input.name} <${input.email}>\n\n${input.body}`,
  })
}
```

`from` stays `onboarding@resend.dev` until a sending domain is verified. Change it to an address on `bryangmills.com` after verification, not before, or Resend will reject the send.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/contact.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Implement the route**

`app/api/contact/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { contactInputSchema } from '@/lib/contact/schema'
import { hashIp, isRateLimited } from '@/lib/contact/rateLimit'
import { sendContactEmail } from '@/lib/contact/mailer'
import { getSql } from '@/lib/db'

export async function POST(request: Request) {
  const parsed = contactInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    // A filled honeypot lands here too. Return the same generic error so a bot
    // learns nothing about why it failed.
    return NextResponse.json({ error: 'Invalid submission.' }, { status: 400 })
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const ipHash = hashIp(ip)

  if (await isRateLimited(ipHash)) {
    return NextResponse.json(
      { error: 'Too many messages. Try again later.' },
      { status: 429 },
    )
  }

  const { name, email, body } = parsed.data

  // Persist BEFORE sending: a Resend outage must not lose a message.
  try {
    const sql = getSql()
    await sql`insert into messages (name, email, body, ip_hash)
              values (${name}, ${email}, ${body}, ${ipHash})`
  } catch (error) {
    console.error('[contact] failed to persist message', error)
    return NextResponse.json(
      { error: 'Could not send right now. Please email me directly.' },
      { status: 500 },
    )
  }

  try {
    await sendContactEmail(parsed.data)
  } catch (error) {
    // The message is safely stored, so the sender is told the truth: received.
    console.error('[contact] resend failed, message is stored', error)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Build the form**

`components/ContactForm.tsx`:
```tsx
'use client'

import { useState } from 'react'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    setError('')
    const data = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.error ?? 'Something went wrong.')
        setStatus('error')
        return
      }
      setStatus('sent')
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <p className="text-[16px] text-ink">
        Got it. I will get back to you.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-lg gap-4">
      <label className="grid gap-1.5">
        <span className="text-[13px] text-pencil">Name</span>
        <input
          name="name"
          required
          maxLength={100}
          className="min-h-11 min-w-0 rounded-sm border border-card-border bg-card px-3 py-2 text-[15px] text-graphite"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-[13px] text-pencil">Email</span>
        <input
          name="email"
          type="email"
          required
          maxLength={200}
          className="min-h-11 min-w-0 rounded-sm border border-card-border bg-card px-3 py-2 text-[15px] text-graphite"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-[13px] text-pencil">Message</span>
        <textarea
          name="body"
          required
          rows={5}
          maxLength={5000}
          className="min-w-0 rounded-sm border border-card-border bg-card px-3 py-2 text-[15px] text-graphite"
        />
      </label>

      {/* Honeypot. Hidden from people, irresistible to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {error ? <p className="text-[14px] text-stamp">{error}</p> : null}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="min-h-11 justify-self-start rounded-sm border-2 border-ink px-5 text-[14px] text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-60"
      >
        {status === 'sending' ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}
```

`min-w-0` on the inputs is required: form controls refuse to shrink below their intrinsic content width and are a classic source of mobile overflow.

`components/sections/Contact.tsx`:
```tsx
import type { Content } from '@/lib/content/schema'
import { ContactForm } from '@/components/ContactForm'

export function Contact({ contact }: { contact: Content['contact'] }) {
  return (
    <section id="contact" className="border-t border-card-border py-14">
      <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-stamp">
        Say hello
      </p>
      <h2 className="font-display text-3xl text-ink sm:text-4xl">
        {contact.heading}
      </h2>
      {contact.blurb ? (
        <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-graphite">
          {contact.blurb}
        </p>
      ) : null}
      <div className="mt-7">
        <ContactForm />
      </div>
    </section>
  )
}
```

- [ ] **Step 7: Compose and verify end to end**

Add `<Contact contact={content.contact} />` to `app/page.tsx` after `<Tracks />`.

```bash
npm run dev &
sleep 5
curl -s -X POST localhost:3000/api/contact -H 'content-type: application/json' \
  -d '{"name":"Test","email":"test@example.com","body":"Hello","website":""}'
curl -s -X POST localhost:3000/api/contact -H 'content-type: application/json' \
  -d '{"name":"Bot","email":"bot@example.com","body":"Spam","website":"http://spam"}'
npm run check:mobile
kill %1
```

Expected: first curl returns `{"ok":true}` and the dev server logs the message body. Second returns `{"error":"Invalid submission."}` with status 400. Mobile check passes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add contact form with honeypot, rate limiting, and Resend

Messages are persisted before the send is attempted so a Resend
outage cannot lose one."
```

---

## Task 10: Error pages, metadata, and accessibility pass

**Files:**
- Create: `app/not-found.tsx`, `app/error.tsx`, `app/robots.ts`, `app/sitemap.ts`, `e2e/site.spec.ts`, `playwright.config.ts`
- Modify: none

**Interfaces:**
- Consumes: everything prior.
- Produces: passing Playwright suite.

- [ ] **Step 1: Build the error pages**

`app/not-found.tsx`:
```tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-4xl px-5 py-24 sm:px-8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-stamp">Error 404</p>
      <h1 className="mt-3 font-display text-4xl text-ink">
        This entry is not in the notebook.
      </h1>
      <p className="mt-4 text-[16px] text-graphite">
        The page you are looking for does not exist, or never did.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center rounded-sm border-2 border-ink px-5 text-[14px] text-ink hover:bg-ink hover:text-paper"
      >
        Back to the first page
      </Link>
    </main>
  )
}
```

`app/error.tsx`:
```tsx
'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-4xl px-5 py-24 sm:px-8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-stamp">Error 500</p>
      <h1 className="mt-3 font-display text-4xl text-ink">
        Something smudged the page.
      </h1>
      <p className="mt-4 text-[16px] text-graphite">
        An unexpected error occurred. Trying again often works.
      </p>
      <button
        onClick={reset}
        className="mt-8 inline-flex min-h-11 items-center rounded-sm border-2 border-ink px-5 text-[14px] text-ink hover:bg-ink hover:text-paper"
      >
        Try again
      </button>
    </main>
  )
}
```

`app/robots.ts`:
```ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://bryangmills.com/sitemap.xml',
  }
}
```

`app/sitemap.ts`:
```ts
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: 'https://bryangmills.com', changeFrequency: 'monthly', priority: 1 }]
}
```

- [ ] **Step 2: Write the Playwright config and specs**

`playwright.config.ts`:
```ts
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
    reuseExistingServer: true,
    timeout: 60000,
  },
})
```

`e2e/site.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test('renders the hero from content', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bryan G. Mills')
})

test('shows both products with working links', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'TerminaLLM' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Parolejo' })).toBeVisible()
  await expect(page.getByRole('link', { name: /terminallm\.app/ })).toHaveAttribute(
    'href',
    'https://terminallm.app',
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
  const response = await request.get('/')
  const html = await response.text()
  // The name must be in the raw HTML, not injected by client JavaScript.
  expect(html).toContain('Bryan G. Mills')
  expect(html).toContain('TerminaLLM')
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

test('contact form submits', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Name').fill('Playwright')
  await page.getByLabel('Email').fill('playwright@example.com')
  await page.getByLabel('Message').fill('Automated test message.')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Got it. I will get back to you.')).toBeVisible()
})
```

- [ ] **Step 3: Install browsers and run**

```bash
npx playwright install chromium
npm run e2e
```

Expected: all specs pass on both the desktop and mobile projects. The `server-renders` test is the one that proves the whole Next.js migration was worth doing; if it fails, content is being fetched client-side and needs fixing.

- [ ] **Step 4: Run the whole suite**

```bash
npm test && npm run e2e && npm run build
```

Expected: unit tests pass, e2e passes, production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add error pages, robots, sitemap, and Playwright suite

Includes a test asserting content is present in server-rendered HTML,
which is the reason for the move off the Vite SPA."
```

---

## Task 11: Deploy to Vercel and bryangmills.com

**Files:**
- Modify: `README.md`
- Create: none

**Interfaces:**
- Consumes: a passing build from Task 10.
- Produces: a live site at `https://bryangmills.com`.

- [ ] **Step 1: Link the Vercel project**

```bash
vercel link --yes
```

Expected: creates `.vercel/project.json`. Confirm `.vercel` is gitignored; add it if not.

- [ ] **Step 2: Push environment variables**

```bash
set -a && source .env.local && set +a
for key in DATABASE_URL AUTH_SECRET ADMIN_GITHUB_LOGIN CONTACT_TO_EMAIL RESEND_API_KEY; do
  printf '%s' "${!key}" | vercel env add "$key" production
  printf '%s' "${!key}" | vercel env add "$key" preview
done
```

Do **not** push `AUTH_GITHUB_ID` or `AUTH_GITHUB_SECRET` yet. Those belong to the development OAuth app, whose callback points at localhost. Production gets its own OAuth app in Plan 2.

- [ ] **Step 3: Deploy a preview and verify**

```bash
vercel deploy
```

Open the preview URL. Confirm the page renders with real content, the contact form works, and there are no console errors. Then:

```bash
CHECK_URL=<preview-url> npm run check:mobile
```

Expected: PASS.

- [ ] **Step 4: Promote to production**

```bash
vercel deploy --prod
```

- [ ] **Step 5: Attach the domain**

```bash
vercel domains add bryangmills.com
```

Vercel prints the exact DNS records required. In the Cloudflare dashboard for `bryangmills.com`, add them **with the proxy disabled (grey cloud, DNS only)**. Proxying Cloudflare in front of Vercel stacks two CDNs and interferes with certificate issuance. Use the records Vercel prints, not remembered IP addresses.

Then verify:

```bash
vercel domains inspect bryangmills.com
curl -sI https://bryangmills.com | head -5
```

Expected: HTTP 200 and a valid certificate. DNS may take a few minutes.

- [ ] **Step 6: Turn off GitHub Pages**

```bash
gh api -X DELETE repos/bmills23/personal_website/pages
```

Expected: 204. This prevents a stale duplicate of the old site from being indexed. If it returns 404, Pages was already off.

- [ ] **Step 7: Rewrite the README**

`README.md`:
```markdown
# Bryan G. Mills, bryangmills.com

Personal site. Next.js 16 App Router on Vercel, content in Neon Postgres with a
seed-file fallback.

## Stack

- Next.js 16 (App Router, Cache Components) + React 19
- Tailwind CSS 4 (CSS-first tokens in `app/globals.css`)
- Neon Postgres via `@neondatabase/serverless`
- Resend for contact-form mail
- Vitest (unit, integration) + Playwright (e2e)

## Development

```bash
npm install
npm run migrate     # apply db/migrations against DATABASE_URL
npm run dev
npm test            # unit and integration
npm run e2e         # Playwright
npm run check:mobile  # CDP overflow check at a true 390x844 viewport
```

Environment lives in `.env.local`, which is gitignored. See the design spec at
`docs/superpowers/specs/2026-07-27-personal-website-design.md`.

## Content

Content is a single JSONB document in the `content` table. `seed/content.json`
is both the starting document and the runtime fallback when the database is
unreachable. Inline editing lands in Plan 2.
```

- [ ] **Step 8: Commit and push**

```bash
git add -A
git commit -m "Deploy to Vercel at bryangmills.com and retire GitHub Pages"
git push origin main
```

---

## Self-Review

**Spec coverage.** Purpose and audience: Tasks 7, 8. Aesthetic direction and palette: Task 2. Typography: Task 2. Motion and the rotation rule: Tasks 2, 6. Icons: Task 5. Information architecture, all seven regions: Tasks 6 through 9. Seed content with real product copy: Task 3. Stack migration: Task 1. Data model: Task 4. Content document shape: Task 3. Contact form: Task 9. Error handling for database-unreachable and Resend-outage: Tasks 4, 9. Accessibility including the contrast fix, skip link, focus rings, decorative `aria-hidden`, reduced motion: Tasks 2, 6, 10. Testing at all four levels: Tasks 2, 3, 4, 9, 10. Deployment, environment variables, Cloudflare DNS, GitHub Pages retirement: Task 11.

**Deferred to Plan 2, by design:** Auth.js and the admin allowlist, the save API with the stale-write precondition and history writes, the `Editable` component, array add/remove/reorder, and the "logged-out visitor sees no editing affordances" e2e test. The path allowlist those depend on is built and hostilely tested in Task 3, so Plan 2 starts from a tested foundation rather than a blank file.

**Versions verified against npm on 2026-07-27,** not written from memory: next 16.2.12, react 19.2.8, tailwindcss 4.3.3, @neondatabase/serverless 1.1.0, resend 6.18.0, zod 4.4.3 (both `z.url()` and `z.string().url()` confirmed working), @phosphor-icons/core 2.1.1, @types/node 24.13.3, typescript 5.9.3, vitest 4.1.10, @playwright/test 1.62.0.

**Two pins that intentionally reject `latest`:** `@types/node` (latest is 26.x, which does not match Node 24) and `typescript` (latest is 7.0.2, a major rewrite that should not be adopted in the same change as a Next.js major).

**Remaining risks, flagged inline rather than hidden:** Phosphor's asset directory layout may differ from the assumed `assets/regular/` (Task 5 Step 5 says how to check); Neon's HTTP driver may reject the interpolated interval in the rate limiter (Task 9 Step 3 gives the `make_interval` alternative). Each has a stated fallback.

**Substitution made knowingly:** Task 5 uses an SVG displacement filter rather than RoughJS. RoughJS renders to canvas and would require pulling `jsdom` into the build to sketch five icons. The visual outcome, a wobbling hand-drawn edge, is what the design asks for. This diverges from the spec's literal wording ("through RoughJS") and is called out here rather than quietly swapped.
