# Personal Website Editor (Plan 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bryan logs in with GitHub and the live page becomes editable in place: click any text, rewrite it, it saves on blur with history, and the public site is byte-identical for everyone else.

**Architecture:** Auth.js v5 (GitHub provider, JWT sessions, admin-only `signIn` callback) guards a set of Server Actions in `app/actions/content.ts` that validate a path against the existing `isEditablePath` allowlist, apply the change in JS, validate the ENTIRE resulting document against `contentSchema`, and write it with an optimistic-concurrency single-statement CTE that snapshots the old doc into `content_history`. A client `EditProvider` + `EditToolbar` + `Editable` component upgrade the server-rendered page in place; in view mode they render exactly today's markup, so visitors (and the cached page) see zero editor traces.

**Tech Stack:** next-auth 5.0.0-beta.32 (exact pin, verified current on npm 2026-07-28), Next.js 16.2.12 Server Actions, `updateTag` from `next/cache`, @neondatabase/serverless 1.1.0, zod 4.4.3, Vitest 4.1.10 (+ jsdom + @testing-library/react already installed), Playwright 1.62.0.

## Why Server Actions instead of the spec's `POST /api/content`

Verified against the installed Next 16.2.12 source (`node_modules/next/dist/server/web/spec-extension/revalidate.js`): **`updateTag` throws in Route Handlers** with "updateTag can only be called from within a Server Action". The spec's requirement is functional (save endpoint with session check, allowlist, length check, stale-write precondition, history transaction, ~1s cache invalidation), and Server Actions satisfy every step while being the only way to get `updateTag`'s read-your-writes semantics. Server Actions also carry Next's built-in Origin/Host checking (CSRF) and are still POST requests under the hood. Do not "fix" this back to a route handler with `revalidateTag`.

## User prerequisites (not blocking Tasks 1-6)

1. **Local `DATABASE_URL` is stale.** The Neon password was rotated after Plan 1; `.env.local` still has the old one (verified: `password authentication failed`, never printed). Bryan must paste the rotated connection string into `.env.local` before Task 7's e2e save tests and before local editor testing. Agents NEVER read or print `.env.local` values; presence checks only.
2. **Dev GitHub OAuth app credentials** (`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`) must be present in `.env.local` (callback `http://localhost:3000/api/auth/callback/github`). Check presence by name only.
3. **Production GitHub OAuth app** (callback `https://bryangmills.com/api/auth/callback/github`) plus Vercel env vars `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_URL=https://bryangmills.com` happen at rollout (Task 8). Until then production must degrade gracefully: public site unaffected, `/login` says the editor is not configured.

## Global Constraints

- **Never use em dashes (U+2014)** anywhere: code, comments, copy, commit messages, test names.
- **Secrets never enter git, chat, or logs.** Never read, cat, echo, or print `.env.local` values. Env presence checks print `set`/`MISSING` only.
- **Never log a caught error object wholesale in code touching the database.** `@neondatabase/serverless` embeds the full connection string in error messages. Log a fixed message plus `error.name` only.
- **Every write action independently re-checks the session and admin login.** No middleware/proxy file: session checks live in the actions themselves (the spec requires per-route re-checks anyway, and skipping `proxy.ts` keeps auth code off the public request path entirely).
- **Visitor DOM purity:** a logged-out visitor's DOM contains no `contenteditable`, no `data-editable`, no toolbar, nothing editor-related, and the server-rendered HTML of every section is byte-identical to today's. No-JS must still mean readable content.
- **Fail closed:** if `ADMIN_GITHUB_LOGIN` or any auth env is unset, logins and saves are rejected, never allowed.
- **Theme tokens only** (`text-pencil`, `text-stamp`, `border-card-border`, etc.); tap targets min 44px (`min-h-11`); reduced-motion respected; decorative elements `aria-hidden`.
- **`npx tsc --noEmit` stays clean. `npm test` stays green. Zero horizontal overflow at a true 390x844 viewport (`npm run check:mobile`).**
- **Mutation evidence for security-critical tests** (Tasks 1, 3, 5): after writing a passing test, break the property it guards (comment out the check, flip the comparison), confirm the test FAILS, restore, confirm it passes. Record the broken-state failure output in the task report. Plan 1 shipped seven assertions that could not fail; do not repeat that.
- **Exact version pins** (`--save-exact`), no new dependencies beyond `next-auth`.
- The `updatedAt` concurrency token is an **opaque string**: always produced by `updated_at::text` in SQL and compared by `updated_at = ${token}::timestamptz`. Never reformat it in JS.

---

### Task 1: Auth core (next-auth, admin gate, handlers)

**Files:**
- Create: `lib/auth/admin.ts`, `lib/auth/index.ts`, `types/next-auth.d.ts`, `app/api/auth/[...nextauth]/route.ts`, `scripts/check-auth-env.mjs`
- Modify: `package.json` (dependency)
- Test: `tests/auth-admin.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `isAdminLogin(login: unknown, adminLogin: string | undefined): boolean`; `authConfigured(): boolean`; `auth()` / `signIn` / `signOut` / `handlers` from `@/lib/auth`; `requireAdminSession(): Promise<{ ok: true; login: string } | { ok: false }>`. Tasks 2, 3, 4 import these exact names from `@/lib/auth` (barrel `lib/auth/index.ts`).

- [ ] **Step 1: Install the pinned dependency**

```bash
npm install --save-exact next-auth@5.0.0-beta.32
```

Confirm `package.json` gains `"next-auth": "5.0.0-beta.32"` with no caret.

- [ ] **Step 2: Write the failing test**

Create `tests/auth-admin.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isAdminLogin } from '@/lib/auth/admin'

describe('isAdminLogin', () => {
  it('accepts the exact admin login', () => {
    expect(isAdminLogin('bmills23', 'bmills23')).toBe(true)
  })
  it('is case-insensitive, matching GitHub login semantics', () => {
    expect(isAdminLogin('BMills23', 'bmills23')).toBe(true)
    expect(isAdminLogin('bmills23', 'BMILLS23')).toBe(true)
  })
  it('rejects any other login', () => {
    expect(isAdminLogin('bmills24', 'bmills23')).toBe(false)
    expect(isAdminLogin('admin', 'bmills23')).toBe(false)
  })
  it('fails closed when the admin login env is missing or empty', () => {
    expect(isAdminLogin('bmills23', undefined)).toBe(false)
    expect(isAdminLogin('bmills23', '')).toBe(false)
  })
  it('fails closed on non-string or empty candidate logins', () => {
    expect(isAdminLogin(undefined, 'bmills23')).toBe(false)
    expect(isAdminLogin(null, 'bmills23')).toBe(false)
    expect(isAdminLogin(42, 'bmills23')).toBe(false)
    expect(isAdminLogin('', 'bmills23')).toBe(false)
    expect(isAdminLogin({ toString: () => 'bmills23' }, 'bmills23')).toBe(false)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/auth-admin.test.ts`
Expected: FAIL, cannot resolve `@/lib/auth/admin`.

- [ ] **Step 4: Implement `lib/auth/admin.ts`**

```ts
/**
 * The single authorization predicate for the whole editor. Both the OAuth
 * signIn callback and every write action funnel through this. It fails
 * closed: a missing ADMIN_GITHUB_LOGIN env means nobody is admin, never
 * everybody.
 */
export function isAdminLogin(login: unknown, adminLogin: string | undefined): boolean {
  if (typeof login !== 'string' || login.length === 0) return false
  if (typeof adminLogin !== 'string' || adminLogin.length === 0) return false
  // GitHub logins are case-insensitive.
  return login.toLowerCase() === adminLogin.toLowerCase()
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/auth-admin.test.ts`
Expected: PASS.

- [ ] **Step 6: Mutation evidence**

Temporarily change the return to `login.toLowerCase() === login.toLowerCase()` and re-run: the "rejects any other login" test MUST fail. Temporarily make the missing-admin branch return `true`: the fail-closed test MUST fail. Restore, re-run, record both failure outputs in the report.

- [ ] **Step 7: Session type augmentation `types/next-auth.d.ts`**

```ts
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & { login?: string }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    login?: string
  }
}
```

If `tsconfig.json`'s `include` does not already cover `types/**/*.ts`, add it.

- [ ] **Step 8: Implement `lib/auth/index.ts`**

```ts
import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import { isAdminLogin } from './admin'

export { isAdminLogin }

/**
 * True only when every env var the editor's auth needs is present. Used to
 * degrade gracefully in production before the prod OAuth app exists: the
 * public site never touches auth, /login explains, and saves are rejected.
 */
export function authConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GITHUB_ID &&
      process.env.AUTH_GITHUB_SECRET &&
      process.env.AUTH_SECRET &&
      process.env.ADMIN_GITHUB_LOGIN,
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    signIn({ profile }) {
      const login = (profile as { login?: unknown } | undefined)?.login
      return isAdminLogin(login, process.env.ADMIN_GITHUB_LOGIN)
    },
    jwt({ token, profile }) {
      const login = (profile as { login?: unknown } | undefined)?.login
      if (typeof login === 'string') token.login = login
      return token
    },
    session({ session, token }) {
      if (session.user && typeof token.login === 'string') {
        session.user.login = token.login
      }
      return session
    },
  },
})

/**
 * The check every write action runs first. Note this re-derives admin-ness
 * from the session token rather than trusting that signIn gated it: a
 * forged or replayed session must still carry the admin login to pass.
 */
export async function requireAdminSession(): Promise<{ ok: true; login: string } | { ok: false }> {
  if (!authConfigured()) return { ok: false }
  try {
    const session = await auth()
    const login = session?.user?.login
    if (!isAdminLogin(login, process.env.ADMIN_GITHUB_LOGIN)) return { ok: false }
    return { ok: true, login: login as string }
  } catch {
    // Auth misconfiguration must read as "not signed in", never as a crash
    // in a write path.
    return { ok: false }
  }
}
```

- [ ] **Step 9: Route handler `app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 10: Env presence check `scripts/check-auth-env.mjs`**

```js
// Prints set/MISSING per auth env var, never values. Uses --env-file so the
// shell never sources the file. Run: node --env-file=.env.local scripts/check-auth-env.mjs
const names = ['AUTH_SECRET', 'AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET', 'ADMIN_GITHUB_LOGIN', 'DATABASE_URL']
for (const name of names) {
  console.log(`${name}: ${process.env[name] ? 'set' : 'MISSING'}`)
}
```

Run it with `node --env-file=.env.local scripts/check-auth-env.mjs` and record which are MISSING in the report (names only). Do not fail the task on MISSING; the report is the deliverable.

- [ ] **Step 11: Full gates and commit**

Run: `npm test && npx tsc --noEmit`
Expected: all green. Then:

```bash
git add package.json package-lock.json lib/auth types/next-auth.d.ts app/api/auth tests/auth-admin.test.ts scripts/check-auth-env.mjs
git commit -m "feat: Auth.js v5 core with admin-only gate"
```

---

### Task 2: /login page

**Files:**
- Create: `app/login/page.tsx`, `components/editor/LoginCard.tsx`
- Test: `tests/login-card.test.tsx`

**Interfaces:**
- Consumes: `auth`, `signIn`, `signOut`, `authConfigured` from `@/lib/auth` (Task 1); `TapedCard` from `@/components/shell/TapedCard`.
- Produces: route `/login`. `LoginCard` is presentational only: `LoginCard({ state, children }: { state: 'unconfigured' | 'denied' | 'signedIn' | 'signedOut'; children?: React.ReactNode })` where `children` is the form the page supplies.

- [ ] **Step 1: Write the failing test**

Create `tests/login-card.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoginCard } from '@/components/editor/LoginCard'

describe('LoginCard', () => {
  it('signedOut state shows the sign-in framing and renders its child form', () => {
    render(
      <LoginCard state="signedOut">
        <button>Sign in with GitHub</button>
      </LoginCard>,
    )
    expect(screen.getByRole('button', { name: /sign in with github/i })).toBeTruthy()
  })
  it('denied state is a plain refusal with no hint it nearly worked', () => {
    render(<LoginCard state="denied" />)
    expect(screen.getByText(/not authorized/i)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/github|admin|login|account/i)
  })
  it('unconfigured state explains the editor is not set up', () => {
    render(<LoginCard state="unconfigured" />)
    expect(screen.getByText(/not configured/i)).toBeTruthy()
  })
  it('signedIn state offers the way home and renders its child form', () => {
    render(
      <LoginCard state="signedIn">
        <button>Sign out</button>
      </LoginCard>,
    )
    expect(screen.getByRole('link', { name: /back to the page/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/login-card.test.tsx`
Expected: FAIL, cannot resolve `@/components/editor/LoginCard`.

- [ ] **Step 3: Implement `components/editor/LoginCard.tsx`**

```tsx
import { TapedCard } from '@/components/shell/TapedCard'

const COPY = {
  unconfigured: {
    heading: 'Editor not configured',
    body: 'The editing environment variables are not set here, so signing in is disabled. The site itself is unaffected.',
  },
  denied: {
    heading: 'Not authorized.',
    body: '',
  },
  signedIn: {
    heading: 'Signed in',
    body: 'Head back to the page and use the pencil toolbar in the corner to edit in place.',
  },
  signedOut: {
    heading: 'Owner sign-in',
    body: 'This unlocks in-place editing for the site owner. There is nothing here for anyone else.',
  },
} as const

export function LoginCard({
  state,
  children,
}: {
  state: keyof typeof COPY
  children?: React.ReactNode
}) {
  const copy = COPY[state]
  return (
    <main id="main" className="mx-auto flex min-h-[60vh] max-w-md items-center px-5 py-16 sm:px-8">
      <TapedCard className="w-full">
        <h1 className="font-display text-2xl text-ink">{copy.heading}</h1>
        {copy.body ? (
          <p className="mt-3 text-[15px] leading-relaxed text-graphite">{copy.body}</p>
        ) : null}
        {state === 'signedIn' ? (
          <p className="mt-4">
            <a href="/?edit=1" className="inline-flex min-h-11 items-center text-ink underline hover:text-stamp">
              Back to the page
            </a>
          </p>
        ) : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </TapedCard>
    </main>
  )
}
```

Check `TapedCard`'s actual props before use (it takes `alt` and `className`; children render inside the card body). The "denied" body is deliberately empty: the spec requires a plain refusal with no hint it nearly worked.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/login-card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implement `app/login/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { auth, authConfigured, isAdminLogin, signIn, signOut } from '@/lib/auth'
import { LoginCard } from '@/components/editor/LoginCard'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  if (!authConfigured()) {
    return <LoginCard state="unconfigured" />
  }
  const session = await auth()
  if (session?.user && isAdminLogin(session.user.login, process.env.ADMIN_GITHUB_LOGIN)) {
    return (
      <LoginCard state="signedIn">
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/' })
          }}
        >
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-sm border border-card-border px-4 text-[14px] text-ink hover:text-stamp"
          >
            Sign out
          </button>
        </form>
      </LoginCard>
    )
  }
  // Auth.js redirects failed sign-ins here with ?error=AccessDenied. Any
  // error value gets the same flat refusal.
  if (typeof params.error === 'string' && params.error.length > 0) {
    return <LoginCard state="denied" />
  }
  return (
    <LoginCard state="signedOut">
      <form
        action={async () => {
          'use server'
          await signIn('github', { redirectTo: '/?edit=1' })
        }}
      >
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-sm border border-card-border bg-ink px-4 text-[14px] text-paper hover:bg-graphite"
        >
          Sign in with GitHub
        </button>
      </form>
    </LoginCard>
  )
}
```

Check the actual theme token names in `app/globals.css` before styling (`bg-ink`, `text-paper`, `bg-paper` etc.); use what exists, never invent tokens.

- [ ] **Step 6: Manual smoke, gates, commit**

Run `npm run dev`, open `http://localhost:3000/login`. With dev OAuth env vars present it shows the sign-in card; without them the unconfigured card. Do not attempt a real OAuth round-trip (needs a browser session); that is Bryan's manual step later. Then:

Run: `npm test && npx tsc --noEmit`
Expected: green.

```bash
git add app/login components/editor/LoginCard.tsx tests/login-card.test.tsx
git commit -m "feat: notebook-styled /login with admin, denied, and unconfigured states"
```

---

### Task 3: Content write engine (server actions)

This is the security core. Everything here gets mutation evidence.

**Files:**
- Create: `lib/content/write.ts`, `app/actions/content.ts`
- Modify: `lib/content/schema.ts` (export two existing sub-schemas; no shape changes)
- Test: `tests/content-write.test.ts`, `tests/content-actions.test.ts`

**Interfaces:**
- Consumes: `isEditablePath` from `@/lib/content/paths`; `contentSchema`, `ARRAY_LIMITS`, `Content` from `@/lib/content/schema`; `getSql` from `@/lib/db`; `requireAdminSession` from `@/lib/auth`; `updateTag` from `next/cache`.
- Produces (used by Tasks 4-7):
  - `lib/content/write.ts`: `applyFieldChange(doc: Content, path: string, value: string): ApplyResult`, `applyArrayChange(doc: Content, key: string, value: unknown): ApplyResult`, `loadCurrent(): Promise<{ doc: Content; updatedAt: string } | null>`, `persistContent(newDoc: Content, expectedUpdatedAt: string): Promise<{ updatedAt: string }>`, `class StaleWriteError`, `type ApplyResult = { ok: true; doc: Content; unchanged: boolean } | { ok: false; reason: 'path' | 'missing' | 'invalid' }`.
  - `app/actions/content.ts` (`'use server'`): `saveField(input: { path: string; value: string; updatedAt: string }): Promise<SaveResult>`, `saveArray(input: { key: string; value: unknown; updatedAt: string }): Promise<SaveResult>`, `revertLastSave(input: { updatedAt: string }): Promise<SaveResult>`, `getEditorState(): Promise<{ ok: true; updatedAt: string } | { ok: false }>`, `type SaveResult = { ok: true; updatedAt: string } | { ok: false; error: 'unauthorized' | 'invalid' | 'stale' | 'nothing-to-revert' | 'server' }`.

- [ ] **Step 1: Export sub-schemas from `lib/content/schema.ts`**

Change `const productSchema` to `export const productSchema` and `const trackEntrySchema` to `export const trackEntrySchema`. Nothing else changes. Run `npm test`: still green.

- [ ] **Step 2: Write the failing tests for the pure layer**

Create `tests/content-write.test.ts`. Build a valid base doc by importing the seed (it is schema-valid by construction; `tests/read.test.ts` already relies on this):

```ts
import { describe, expect, it } from 'vitest'
import seed from '@/seed/content.json'
import { contentSchema, type Content } from '@/lib/content/schema'
import { applyFieldChange, applyArrayChange } from '@/lib/content/write'

const doc: Content = contentSchema.parse(seed)

describe('applyFieldChange', () => {
  it('rewrites an allowlisted leaf and returns a schema-valid doc', () => {
    const result = applyFieldChange(doc, 'about.heading', 'A new heading')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.doc.about.heading).toBe('A new heading')
      expect(result.unchanged).toBe(false)
      expect(() => contentSchema.parse(result.doc)).not.toThrow()
    }
  })
  it('never mutates the input document', () => {
    const before = JSON.stringify(doc)
    applyFieldChange(doc, 'about.heading', 'Mutation check')
    expect(JSON.stringify(doc)).toBe(before)
  })
  it('flags an identical value as unchanged', () => {
    const result = applyFieldChange(doc, 'about.heading', doc.about.heading)
    expect(result.ok && result.unchanged).toBe(true)
  })
  it('rejects a path outside the allowlist', () => {
    expect(applyFieldChange(doc, 'version', '2')).toEqual({ ok: false, reason: 'path' })
    expect(applyFieldChange(doc, 'products.0.id', 'x')).toEqual({ ok: false, reason: 'path' })
  })
  it('rejects an allowlisted pattern whose index does not exist in this doc', () => {
    // products cap is 6 but the seed has 2, so index 5 passes the allowlist
    // and must be caught by the existence check.
    expect(applyFieldChange(doc, 'products.5.name', 'ghost')).toEqual({ ok: false, reason: 'missing' })
  })
  it('rejects a value the whole-document schema refuses', () => {
    expect(applyFieldChange(doc, 'hero.name', '')).toEqual({ ok: false, reason: 'invalid' })
    expect(applyFieldChange(doc, 'hero.stamp', 'x'.repeat(21))).toEqual({ ok: false, reason: 'invalid' })
  })
  it('rejects javascript: URLs through the link url path', () => {
    expect(applyFieldChange(doc, 'footer.links.0.url', 'javascript:alert(1)')).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })
  it('rejects control characters and newlines', () => {
    expect(applyFieldChange(doc, 'about.heading', 'line\nbreak')).toEqual({ ok: false, reason: 'invalid' })
    expect(applyFieldChange(doc, 'about.heading', 'nul\u0000byte')).toEqual({ ok: false, reason: 'invalid' })
  })
})

describe('applyArrayChange', () => {
  it('replaces the products array wholesale', () => {
    const next = [...doc.products].reverse()
    const result = applyArrayChange(doc, 'products', next)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.doc.products[0].id).toBe(doc.products[1].id)
  })
  it('replaces one track entries array', () => {
    const entries = [...doc.tracks[0].entries]
    const result = applyArrayChange(doc, 'tracks.0.entries', entries)
    expect(result.ok).toBe(true)
  })
  it('rejects unknown keys, including attempts at other arrays', () => {
    expect(applyArrayChange(doc, 'tracks', []).ok).toBe(false)
    expect(applyArrayChange(doc, 'footer.links', []).ok).toBe(false)
    expect(applyArrayChange(doc, '__proto__', []).ok).toBe(false)
  })
  it('rejects a tracks index that does not exist', () => {
    expect(applyArrayChange(doc, 'tracks.2.entries', [])).toEqual({ ok: false, reason: 'missing' })
  })
  it('rejects arrays over the schema cap', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...doc.products[0], id: `p${i}` }))
    expect(applyArrayChange(doc, 'products', many)).toEqual({ ok: false, reason: 'invalid' })
  })
  it('rejects duplicate ids within the array', () => {
    const dupes = [doc.products[0], { ...doc.products[1], id: doc.products[0].id }]
    expect(applyArrayChange(doc, 'products', dupes)).toEqual({ ok: false, reason: 'invalid' })
  })
  it('rejects structurally invalid members', () => {
    expect(applyArrayChange(doc, 'products', [{ id: 'x' }])).toEqual({ ok: false, reason: 'invalid' })
  })
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/content-write.test.ts`
Expected: FAIL, cannot resolve `@/lib/content/write`.

- [ ] **Step 4: Implement the pure layer in `lib/content/write.ts`**

```ts
import { z } from 'zod'
import { getSql } from '@/lib/db'
import { isEditablePath } from './paths'
import { contentSchema, productSchema, trackEntrySchema, type Content } from './schema'

export type ApplyResult =
  | { ok: true; doc: Content; unchanged: boolean }
  | { ok: false; reason: 'path' | 'missing' | 'invalid' }

/** Control characters (including newlines) never belong in these
 * single-paragraph fields; Enter commits an edit rather than inserting a
 * break, so any that arrive were injected, not typed. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/

export function applyFieldChange(doc: Content, path: string, value: string): ApplyResult {
  if (!isEditablePath(path)) return { ok: false, reason: 'path' }
  if (typeof value !== 'string' || CONTROL_CHARS.test(value)) return { ok: false, reason: 'invalid' }

  const segments = path.split('.')
  const next = structuredClone(doc) as unknown as Record<string, unknown>
  let node: unknown = next
  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(node)) {
      node = node[Number(segment)]
    } else if (node !== null && typeof node === 'object') {
      node = (node as Record<string, unknown>)[segment]
    } else {
      node = undefined
    }
    if (node === undefined) return { ok: false, reason: 'missing' }
  }

  const leaf = segments[segments.length - 1]
  const container = node
  let current: unknown
  if (Array.isArray(container)) {
    current = container[Number(leaf)]
  } else if (container !== null && typeof container === 'object') {
    current = (container as Record<string, unknown>)[leaf]
  }
  // The allowlist only names string leaves; anything else at this position
  // means the path does not exist in THIS document (e.g. products.5.name
  // when there are two products), which jsonb_set-style writes would
  // silently no-op on. Reject loudly instead.
  if (typeof current !== 'string') return { ok: false, reason: 'missing' }

  if (current === value) return { ok: true, doc, unchanged: true }

  if (Array.isArray(container)) {
    container[Number(leaf)] = value
  } else {
    ;(container as Record<string, unknown>)[leaf] = value
  }

  const parsed = contentSchema.safeParse(next)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return { ok: true, doc: parsed.data, unchanged: false }
}

const ARRAY_KEY_RE = /^(products|tracks\.(\d)\.entries)$/
const productsArraySchema = z.array(productSchema)
const entriesArraySchema = z.array(trackEntrySchema)

function hasUniqueIds(items: { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length
}

export function applyArrayChange(doc: Content, key: string, value: unknown): ApplyResult {
  const match = typeof key === 'string' ? ARRAY_KEY_RE.exec(key) : null
  if (!match) return { ok: false, reason: 'path' }

  const next = structuredClone(doc)
  if (match[1] === 'products') {
    const parsed = productsArraySchema.safeParse(value)
    if (!parsed.success || !hasUniqueIds(parsed.data)) return { ok: false, reason: 'invalid' }
    next.products = parsed.data
  } else {
    const trackIndex = Number(match[2])
    if (trackIndex >= doc.tracks.length) return { ok: false, reason: 'missing' }
    const parsed = entriesArraySchema.safeParse(value)
    if (!parsed.success || !hasUniqueIds(parsed.data)) return { ok: false, reason: 'invalid' }
    next.tracks[trackIndex].entries = parsed.data
  }

  const parsed = contentSchema.safeParse(next)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const unchanged = JSON.stringify(parsed.data) === JSON.stringify(doc)
  return { ok: true, doc: parsed.data, unchanged }
}

export class StaleWriteError extends Error {
  constructor() {
    super('content row changed since it was read')
    this.name = 'StaleWriteError'
  }
}

/**
 * Reads the live row (never the seed fallback: you cannot edit a document
 * that is not really there). Returns null when the row is missing, the
 * stored doc fails validation, or the database is unreachable.
 */
export async function loadCurrent(): Promise<{ doc: Content; updatedAt: string } | null> {
  try {
    const sql = getSql()
    const rows = await sql`select doc, updated_at::text as updated_at from content where id = 1`
    if (rows.length === 0) return null
    const parsed = contentSchema.safeParse(rows[0].doc)
    if (!parsed.success) return null
    return { doc: parsed.data, updatedAt: rows[0].updated_at as string }
  } catch (error) {
    // Fixed message plus error.name only: the neon driver embeds the full
    // connection string in some error messages.
    console.error('[editor] loadCurrent failed', error instanceof Error ? error.name : 'unknown error')
    return null
  }
}

/**
 * Single-statement optimistic write: snapshot the current doc into history
 * and replace it, both gated on updated_at still matching the value the
 * mutation was computed from. One statement means one snapshot: the
 * history copy and the overwrite can never disagree about "current".
 */
export async function persistContent(
  newDoc: Content,
  expectedUpdatedAt: string,
): Promise<{ updatedAt: string }> {
  const sql = getSql()
  const rows = await sql`
    with snap as (
      insert into content_history (doc)
      select doc from content where id = 1 and updated_at = ${expectedUpdatedAt}::timestamptz
      returning id
    )
    update content
       set doc = ${JSON.stringify(newDoc)}::jsonb, updated_at = now()
     where id = 1
       and updated_at = ${expectedUpdatedAt}::timestamptz
       and exists (select 1 from snap)
     returning updated_at::text as updated_at
  `
  if (rows.length === 0) throw new StaleWriteError()
  return { updatedAt: rows[0].updated_at as string }
}
```

- [ ] **Step 5: Run the pure-layer tests**

Run: `npx vitest run tests/content-write.test.ts`
Expected: PASS.

- [ ] **Step 6: Mutation evidence on the pure layer**

Three mutations, each: break, run, confirm the named test fails, restore.
1. Comment out the `isEditablePath` check: the "path outside the allowlist" test MUST fail.
2. Change the existence check to accept `undefined` leaves: the "index does not exist" test MUST fail.
3. Skip the final `contentSchema.safeParse` and return `next` directly: the `javascript:` URL test MUST fail.
Record all three failure outputs in the report.

- [ ] **Step 7: Write the failing action tests**

Create `tests/content-actions.test.ts`. Mock the session, the db module, and `next/cache`; assert ordering (unauthorized checks happen before any database touch) and that `updateTag` fires only on a successful write:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import seed from '@/seed/content.json'
import { contentSchema } from '@/lib/content/schema'

const requireAdminSession = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAdminSession: () => requireAdminSession() }))

const updateTag = vi.fn()
vi.mock('next/cache', () => ({ updateTag: (tag: string) => updateTag(tag) }))

const sqlCalls: string[] = []
let sqlResults: unknown[][] = []
vi.mock('@/lib/db', () => ({
  getSql: () => {
    return (strings: TemplateStringsArray, ..._values: unknown[]) => {
      sqlCalls.push(strings.join('$'))
      return Promise.resolve(sqlResults.shift() ?? [])
    }
  },
}))

const doc = contentSchema.parse(seed)
const TOKEN = '2026-07-28 08:00:00.000+00'

function primeLoad() {
  sqlResults.push([{ doc, updated_at: TOKEN }])
}

beforeEach(() => {
  vi.clearAllMocks()
  sqlCalls.length = 0
  sqlResults = []
})

describe('saveField', () => {
  it('rejects before touching the database when there is no admin session', async () => {
    requireAdminSession.mockResolvedValue({ ok: false })
    const { saveField } = await import('@/app/actions/content')
    const result = await saveField({ path: 'about.heading', value: 'X', updatedAt: TOKEN })
    expect(result).toEqual({ ok: false, error: 'unauthorized' })
    expect(sqlCalls).toHaveLength(0)
    expect(updateTag).not.toHaveBeenCalled()
  })
  it('rejects a bad path before touching the database', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    const { saveField } = await import('@/app/actions/content')
    const result = await saveField({ path: 'version', value: '2', updatedAt: TOKEN })
    expect(result).toEqual({ ok: false, error: 'invalid' })
    expect(sqlCalls).toHaveLength(0)
  })
  it('writes, snapshots history, and invalidates the content tag', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    sqlResults.push([{ updated_at: '2026-07-28 08:00:01.000+00' }])
    const { saveField } = await import('@/app/actions/content')
    const result = await saveField({ path: 'about.heading', value: 'Fresh heading', updatedAt: TOKEN })
    expect(result).toEqual({ ok: true, updatedAt: '2026-07-28 08:00:01.000+00' })
    expect(sqlCalls[1]).toContain('content_history')
    expect(sqlCalls[1]).toContain('update content')
    expect(updateTag).toHaveBeenCalledWith('content')
  })
  it('reports stale when the client token does not match the stored row', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    const { saveField } = await import('@/app/actions/content')
    const result = await saveField({ path: 'about.heading', value: 'X', updatedAt: 'some-older-token' })
    expect(result).toEqual({ ok: false, error: 'stale' })
    expect(updateTag).not.toHaveBeenCalled()
  })
  it('reports stale when the guarded write affects zero rows', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    sqlResults.push([]) // the CTE write returns no rows: lost the race
    const { saveField } = await import('@/app/actions/content')
    const result = await saveField({ path: 'about.heading', value: 'X', updatedAt: TOKEN })
    expect(result).toEqual({ ok: false, error: 'stale' })
    expect(updateTag).not.toHaveBeenCalled()
  })
  it('returns ok without writing when the value is unchanged', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    const { saveField } = await import('@/app/actions/content')
    const result = await saveField({ path: 'about.heading', value: doc.about.heading, updatedAt: TOKEN })
    expect(result).toEqual({ ok: true, updatedAt: TOKEN })
    expect(sqlCalls).toHaveLength(1) // the read, no write
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('saveArray', () => {
  it('rejects an unknown array key before touching the database', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    const { saveArray } = await import('@/app/actions/content')
    const result = await saveArray({ key: 'footer.links', value: [], updatedAt: TOKEN })
    expect(result).toEqual({ ok: false, error: 'invalid' })
    expect(sqlCalls).toHaveLength(0)
  })
  it('rejects without an admin session before touching the database', async () => {
    requireAdminSession.mockResolvedValue({ ok: false })
    const { saveArray } = await import('@/app/actions/content')
    const result = await saveArray({ key: 'products', value: [], updatedAt: TOKEN })
    expect(result).toEqual({ ok: false, error: 'unauthorized' })
    expect(sqlCalls).toHaveLength(0)
  })
})

describe('getEditorState', () => {
  it('refuses without an admin session', async () => {
    requireAdminSession.mockResolvedValue({ ok: false })
    const { getEditorState } = await import('@/app/actions/content')
    expect(await getEditorState()).toEqual({ ok: false })
    expect(sqlCalls).toHaveLength(0)
  })
  it('returns the opaque token for the admin', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    const { getEditorState } = await import('@/app/actions/content')
    expect(await getEditorState()).toEqual({ ok: true, updatedAt: TOKEN })
  })
})

describe('revertLastSave', () => {
  it('reports nothing-to-revert on an empty history', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    sqlResults.push([]) // history query: empty
    const { revertLastSave } = await import('@/app/actions/content')
    expect(await revertLastSave({ updatedAt: TOKEN })).toEqual({ ok: false, error: 'nothing-to-revert' })
  })
  it('restores the newest history doc and invalidates the tag', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    const olderDoc = structuredClone(doc)
    olderDoc.about.heading = 'The older heading'
    sqlResults.push([{ id: 7, doc: olderDoc }])
    sqlResults.push([{ updated_at: '2026-07-28 08:00:02.000+00' }])
    const { revertLastSave } = await import('@/app/actions/content')
    const result = await revertLastSave({ updatedAt: TOKEN })
    expect(result).toEqual({ ok: true, updatedAt: '2026-07-28 08:00:02.000+00' })
    expect(updateTag).toHaveBeenCalledWith('content')
  })
  it('refuses to restore a history doc that fails the schema', async () => {
    requireAdminSession.mockResolvedValue({ ok: true, login: 'bmills23' })
    primeLoad()
    sqlResults.push([{ id: 7, doc: { garbage: true } }])
    const { revertLastSave } = await import('@/app/actions/content')
    expect(await revertLastSave({ updatedAt: TOKEN })).toEqual({ ok: false, error: 'server' })
    expect(updateTag).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 8: Run to verify they fail**

Run: `npx vitest run tests/content-actions.test.ts`
Expected: FAIL, cannot resolve `@/app/actions/content`.

- [ ] **Step 9: Implement `app/actions/content.ts`**

```ts
'use server'

import { z } from 'zod'
import { updateTag } from 'next/cache'
import { requireAdminSession } from '@/lib/auth'
import {
  applyArrayChange,
  applyFieldChange,
  isArrayKey,
  loadCurrent,
  persistContent,
  StaleWriteError,
  type ApplyResult,
} from '@/lib/content/write'
import { isEditablePath } from '@/lib/content/paths'
import { contentSchema, type Content } from '@/lib/content/schema'
import { getSql } from '@/lib/db'

export type SaveResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: 'unauthorized' | 'invalid' | 'stale' | 'nothing-to-revert' | 'server' }

// Generous pre-gates; the whole-document schema is the real bound.
const fieldInput = z.object({
  path: z.string().min(1).max(120),
  value: z.string().max(2000),
  updatedAt: z.string().min(1).max(64),
})
const arrayInput = z.object({
  key: z.string().min(1).max(40),
  value: z.unknown(),
  updatedAt: z.string().min(1).max(64),
})
const revertInput = z.object({ updatedAt: z.string().min(1).max(64) })

async function commit(
  mutate: (doc: Content) => ApplyResult,
  clientToken: string,
): Promise<SaveResult> {
  const current = await loadCurrent()
  if (!current) return { ok: false, error: 'server' }
  // Client staleness: the edit was made against an older document.
  if (current.updatedAt !== clientToken) return { ok: false, error: 'stale' }

  const applied = mutate(current.doc)
  // 'path', 'missing', and 'invalid' are all client-fixable rejections; the
  // distinction matters for tests, not for the toolbar message.
  if (!applied.ok) return { ok: false, error: 'invalid' }
  if (applied.unchanged) return { ok: true, updatedAt: current.updatedAt }

  try {
    // The WHERE inside persistContent uses current.updatedAt (the token of
    // the doc the mutation was computed from), which closes the race
    // between our read and our write.
    const { updatedAt } = await persistContent(applied.doc, current.updatedAt)
    updateTag('content')
    return { ok: true, updatedAt }
  } catch (error) {
    if (error instanceof StaleWriteError) return { ok: false, error: 'stale' }
    console.error('[editor] save failed', error instanceof Error ? error.name : 'unknown error')
    return { ok: false, error: 'server' }
  }
}

export async function saveField(input: {
  path: string
  value: string
  updatedAt: string
}): Promise<SaveResult> {
  const admin = await requireAdminSession()
  if (!admin.ok) return { ok: false, error: 'unauthorized' }
  const parsed = fieldInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }
  const { path, value, updatedAt } = parsed.data
  // An obviously bad path must not cost a database read.
  if (!isEditablePath(path)) return { ok: false, error: 'invalid' }
  return commit((doc) => applyFieldChange(doc, path, value), updatedAt)
}

export async function saveArray(input: {
  key: string
  value: unknown
  updatedAt: string
}): Promise<SaveResult> {
  const admin = await requireAdminSession()
  if (!admin.ok) return { ok: false, error: 'unauthorized' }
  const parsed = arrayInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }
  const { key, value, updatedAt } = parsed.data
  // An obviously bad key must not cost a database read.
  if (!isArrayKey(key)) return { ok: false, error: 'invalid' }
  return commit((doc) => applyArrayChange(doc, key, value), updatedAt)
}

export async function revertLastSave(input: { updatedAt: string }): Promise<SaveResult> {
  const admin = await requireAdminSession()
  if (!admin.ok) return { ok: false, error: 'unauthorized' }
  const parsed = revertInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const current = await loadCurrent()
  if (!current) return { ok: false, error: 'server' }
  if (current.updatedAt !== parsed.data.updatedAt) return { ok: false, error: 'stale' }

  try {
    const sql = getSql()
    const historyRows = await sql`select id, doc from content_history order by id desc limit 1`
    if (historyRows.length === 0) return { ok: false, error: 'nothing-to-revert' }
    const restored = contentSchema.safeParse(historyRows[0].doc)
    if (!restored.success) return { ok: false, error: 'server' }
    const historyId = historyRows[0].id as number

    // Snapshot current, consume the restored history row, and swap the doc
    // in one statement so a race cannot leave history half-applied. Revert
    // twice returns to where you started; nothing is ever lost.
    const rows = await sql`
      with snap as (
        insert into content_history (doc)
        select doc from content where id = 1 and updated_at = ${current.updatedAt}::timestamptz
        returning id
      ), consumed as (
        delete from content_history
         where id = ${historyId} and exists (select 1 from snap)
        returning id
      )
      update content
         set doc = ${JSON.stringify(restored.data)}::jsonb, updated_at = now()
       where id = 1
         and updated_at = ${current.updatedAt}::timestamptz
         and exists (select 1 from consumed)
       returning updated_at::text as updated_at
    `
    if (rows.length === 0) return { ok: false, error: 'stale' }
    updateTag('content')
    return { ok: true, updatedAt: rows[0].updated_at as string }
  } catch (error) {
    console.error('[editor] revert failed', error instanceof Error ? error.name : 'unknown error')
    return { ok: false, error: 'server' }
  }
}

export async function getEditorState(): Promise<{ ok: true; updatedAt: string } | { ok: false }> {
  const admin = await requireAdminSession()
  if (!admin.ok) return { ok: false }
  const current = await loadCurrent()
  if (!current) return { ok: false }
  return { ok: true, updatedAt: current.updatedAt }
}
```

`isArrayKey` is a one-liner exported from `lib/content/write.ts` so the action and the pure layer share the same regex: `export function isArrayKey(key: string): boolean { return typeof key === 'string' && ARRAY_KEY_RE.test(key) }`. The pure layer stays the authority; the pre-checks in the actions only enforce "no database read on obviously bad input".

- [ ] **Step 10: Run the action tests**

Run: `npx vitest run tests/content-actions.test.ts`
Expected: PASS.

- [ ] **Step 11: Mutation evidence on the actions**

1. Remove the `requireAdminSession` check from `saveField`: the unauthorized test MUST fail.
2. Move `updateTag('content')` above `persistContent` so it fires unconditionally: the stale tests MUST fail.
3. Remove the `current.updatedAt !== clientToken` early return: the "client token does not match" test MUST fail.
Restore all, record failures in the report.

- [ ] **Step 12: Full gates and commit**

Run: `npm test && npx tsc --noEmit`
Expected: green.

```bash
git add lib/content/schema.ts lib/content/write.ts app/actions/content.ts tests/content-write.test.ts tests/content-actions.test.ts
git commit -m "feat: content write engine with allowlist, whole-doc validation, and optimistic history"
```

---

### Task 4: EditProvider, editor hint, EditToolbar

**Files:**
- Create: `components/editor/EditProvider.tsx`, `components/editor/EditToolbar.tsx`, `lib/editor/hint.ts`, `app/actions/auth.ts`
- Modify: `app/layout.tsx` (wrap children), `app/globals.css` (toolbar styles if needed beyond utilities)
- Test: `tests/edit-provider.test.tsx`

**Interfaces:**
- Consumes: `getEditorState`, `revertLastSave`, `type SaveResult` from `@/app/actions/content` (Task 3); `signOut` from `@/lib/auth` (Task 1, via new `signOutAction`).
- Produces (used by Tasks 5-6):
  - `lib/editor/hint.ts`: `hasEditorHint(): boolean`, `setEditorHint(): void`, `clearEditorHint(): void` (localStorage key `'bgm-editor'`; all three guard `typeof window === 'undefined'`).
  - `EditProvider` client context via `useEditor()`: `{ session: 'unknown' | 'none' | 'admin'; editing: boolean; updatedAt: string | null; toggleEditing(): void; setUpdatedAt(token: string): void; status: SaveStatus; reportStatus(status: SaveStatus): void }` with `type SaveStatus = { state: 'idle' } | { state: 'saving' } | { state: 'saved' } | { state: 'error'; message: string }`.
  - `app/actions/auth.ts`: `signOutAction(): Promise<void>` (`'use server'`, calls `signOut({ redirect: false })`).

**Behavior contract:**
- On mount, if the URL has `?edit=1` (read `window.location.search` inside the effect; do NOT use `useSearchParams`, which would force a Suspense boundary into the layout): call `setEditorHint()` and strip the param with `history.replaceState`. Then, if `hasEditorHint()` is false, do nothing at all (session stays `'unknown'`, no network traffic: first-time visitors never hit an auth endpoint). If the hint is set, call `getEditorState()`: `ok` → session `'admin'`, store `updatedAt`; not ok → session `'none'`, `clearEditorHint()`.
- The toolbar renders `null` unless session is `'admin'` (server render and initial client render are both `null`, so hydration matches and visitor DOM stays clean).
- Toolbar contents, all `min-h-11`: an "Edit page" toggle (`aria-pressed`), a "Revert last save" button (wrapped in `window.confirm('Revert the most recent save?')`; calls `revertLastSave({ updatedAt })`, then `setUpdatedAt` + `router.refresh()` on success, `reportStatus` error mapping on failure), a "Sign out" button (calls `signOutAction()`, then `clearEditorHint()` and `location.assign('/')`), and a status region `<p aria-live="polite">` rendering Saving / Saved / error text.
- Error message mapping used by toolbar AND (Task 5) Editable: `unauthorized` → "Not signed in. Reload the page.", `stale` → "This page changed elsewhere. Reload before editing.", `invalid` → "Not saved: that value is not allowed.", `nothing-to-revert` → "Nothing to revert.", `server` → "Not saved: server error." Export as `saveErrorMessage(error: Extract<SaveResult, { ok: false }>['error']): string` from `EditProvider.tsx`.
- Toolbar position: `fixed bottom-4 right-4 z-30`, notebook-card styling with existing tokens (`bg-paper border border-card-border shadow-sm rounded-sm px-3 py-2 flex items-center gap-2`). No tilt (it is a control, not decoration). Must not overflow at 390px (it is fixed-position, so it cannot widen the layout, but keep its own width under 358px).

- [ ] **Step 1: Write the failing tests**

`tests/edit-provider.test.tsx` (jsdom pragma). Mock `@/app/actions/content` and `@/app/actions/auth` at module level; mock `next/navigation`'s `useRouter` to a stub with a `refresh` spy. Cover:
1. Without hint: `getEditorState` never called; toolbar absent from DOM.
2. With hint + `getEditorState` resolving `{ ok: true, updatedAt: 'T' }`: toolbar appears, session admin.
3. With hint + `{ ok: false }`: toolbar absent AND `localStorage.getItem('bgm-editor')` is null afterwards (hint cleared).
4. `?edit=1` in the URL sets the hint and is stripped (assert `history.replaceState` result via `window.location.search`).
5. Toggle button flips `aria-pressed` and `useEditor().editing` (expose via a probe child component in the test).
6. Revert button: confirm mocked true → `revertLastSave` called with the current token; on `{ ok: true, updatedAt: 'T2' }` the router refresh spy fires.
7. Revert with confirm mocked false → `revertLastSave` NOT called.
8. `saveErrorMessage` returns the exact five strings above.

Run: `npx vitest run tests/edit-provider.test.tsx` → FAIL (modules missing).

- [ ] **Step 2: Implement `lib/editor/hint.ts`, `app/actions/auth.ts`, `EditProvider.tsx`, `EditToolbar.tsx`**

`app/actions/auth.ts`:

```ts
'use server'

import { signOut } from '@/lib/auth'

export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false })
}
```

`EditProvider` holds the context + effects described in the behavior contract; `EditToolbar` consumes it. The provider renders `<>{children}<EditToolbar /></>` so layout only mounts one component. Keep both files under ~120 lines; no animation; buttons are plain elements with theme tokens.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run tests/edit-provider.test.tsx`
Expected: PASS.

- [ ] **Step 4: Mount in `app/layout.tsx`**

Wrap `{children}` (only children; Nav and skip link stay outside):

```tsx
<EditProvider>{children}</EditProvider>
```

`EditProvider` is a client component receiving server children; this adds no DOM wrapper.

- [ ] **Step 5: Server markup purity check**

Run `npm run build && npm run start` briefly (or dev server) and `curl -s http://localhost:3000 | grep -ci 'contenteditable\|data-editable\|Revert last save'`.
Expected: `0`. Kill the server afterwards; never leave one on port 3000.

- [ ] **Step 6: Full gates and commit**

Run: `npm test && npx tsc --noEmit`

```bash
git add components/editor lib/editor app/actions/auth.ts app/layout.tsx tests/edit-provider.test.tsx
git commit -m "feat: edit-mode provider, hint gating, and floating editor toolbar"
```

---

### Task 5: Editable component and section integration

**Files:**
- Create: `components/editor/Editable.tsx`, `components/editor/EditableLink.tsx`, `components/editor/HeadingEditable.tsx`, `components/editor/EditableMarginNote.tsx`
- Modify: `components/sections/Hero.tsx`, `About.tsx`, `Products.tsx`, `Tracks.tsx`, `Contact.tsx`, `components/shell/Footer.tsx`, `app/globals.css`
- Test: `tests/editable.test.tsx`

**Interfaces:**
- Consumes: `useEditor`, `saveErrorMessage` from `@/components/editor/EditProvider`; `saveField` from `@/app/actions/content`; `WrittenHeading`, `MarginNote` from shell.
- Produces:
  - `Editable({ path, text, as = 'span', className, children }: { path: string; text: string; as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'li'; className?: string; children?: React.ReactNode })`. **View mode:** if `text` is empty, render `null`; else render `<As className>{children ?? text}</As>`, exactly the markup sections render today (children carries rich content like the hero lede's highlight segments). **Edit mode:** render `<As>` with `contentEditable`, `suppressContentEditableWarning`, `role="textbox"`, `aria-label={'Edit ' + path}`, `data-editable={path}`, className plus `editable`, keyed so entering edit mode remounts with plain `text` as content (uncontrolled after that; the DOM owns the draft).
  - `EditableLink({ labelPath, urlPath, label, url, className })`: view mode renders the exact current `<a target="_blank" rel="noopener noreferrer">` markup; edit mode renders a `<span className={className}>` with an Editable-style label plus a small `<input type="url">` beneath (classes `editable-url-input`), each saving its own path on blur; clicks are `preventDefault`ed in edit mode.
  - `HeadingEditable({ path, text, className })`: view mode renders `<WrittenHeading as="h2" className={className}>{text}</WrittenHeading>` unchanged; edit mode renders an editable plain `h2` with the same className (no write animation while editing).
  - `EditableMarginNote({ path, text, wrapper }: { path: string; text: string; wrapper: 'aside' | 'div' })`: view mode reproduces the current conditional (`text` empty → `null`, else wrapper + `MarginNote`); edit mode always renders the slot so an emptied optional field can be re-edited, with `data-placeholder="margin note"` styling when empty.

**Editing behavior (Editable and both wrappers):**
- Paste: `preventDefault`; read `event.clipboardData.getData('text/plain')`; strip control chars (`/[\u0000-\u001F\u007F]/g`) and collapse to a single line; insert at the caret by Range manipulation (`deleteContents` + `insertNode(document.createTextNode(clean))`, then collapse the selection after the node). No `document.execCommand`.
- Drop: `preventDefault` on `onDrop` (dragged content can carry HTML past the paste handler).
- Formatting shortcuts: `onKeyDown` swallows Cmd/Ctrl+B, +I, and +U with `preventDefault` (browsers apply bold/italic markup inside contentEditable). Also set `contentEditable="plaintext-only"` rather than `"true"` (React 19 types allow it; supported in Chrome, Safari, and Firefox 136+); the explicit handlers remain as the tested guarantee, the attribute is defense in depth. The commit path reading `textContent` means markup could never reach the server either way.
- Enter: `preventDefault` + blur (blur commits).
- Escape: restore the pre-edit text into the element and blur without saving.
- Blur/commit: read `element.textContent ?? ''`, trim it; if it equals the last-saved value, do nothing. Otherwise `reportStatus({ state: 'saving' })`, call `saveField({ path, value, updatedAt })`. On `ok`: `setUpdatedAt(result.updatedAt)`, `reportStatus({ state: 'saved' })` (provider auto-clears to idle after ~2s), `router.refresh()`. On failure: restore the previous text into the DOM, `reportStatus({ state: 'error', message: saveErrorMessage(result.error) })`.
- If `updatedAt` in context is `null`, commits refuse with the `server` error message (cannot save without a token).

**CSS additions to `app/globals.css`** (inside the existing token system; exact selectors):

```css
.editable {
  outline: 1.5px dashed var(--color-pencil);
  outline-offset: 3px;
  border-radius: 2px;
  cursor: text;
  min-width: 1.5rem;
}
.editable:focus-visible {
  outline: 2px solid var(--color-stamp);
}
.editable:empty::before {
  content: attr(data-placeholder);
  color: var(--color-pencil);
  opacity: 0.6;
}
.editable-url-input {
  display: block;
  margin-top: 0.25rem;
  width: 100%;
  max-width: 20rem;
  border: 1px solid var(--color-card-border);
  border-radius: 2px;
  background: var(--color-paper);
  padding: 0.375rem 0.5rem;
  font-size: 12px;
  color: var(--color-ink);
}
```

Verify the CSS variable names against `app/globals.css` `@theme` block first (`--color-pencil` etc. are Tailwind v4 theme tokens); use the names that actually exist.

**Section integration map (view-mode markup must stay byte-identical):**
- Hero: `hero.kicker` (as `p`, existing classes), `hero.name` (as `h1`; view mode stays a plain h1, the LCP rule holds), `hero.lede` (as `p`, `children` = the existing `splitHighlights` segments), `hero.stamp` (Editable as `span` INSIDE `<Stamp>`). The hardcoded hero margin note is not content-backed and stays untouched.
- About: `about.heading` via `HeadingEditable`; each paragraph `about.paragraphs.${i}` (as `p`); `about.marginNote` via `EditableMarginNote` replacing the current conditional (wrapper `aside` with class `md:pt-2`).
- Products: `sections.products.kicker` (as `p`); the `WrittenHeading` "Products" stays non-editable; per product: `products.${i}.name` (as `h3`), `.tagline` (as `p`), `.body` (as `p`); per tag `products.${i}.tags.${j}` (as `li`, key by index in edit-aware rendering); links via `EditableLink` with `products.${i}.links.${j}.label` / `.url`.
- Tracks: `sections.work.kicker`; per track `tracks.${i}.label`; per entry `.org` (as `h3`), `.role` and `.period` (two Editables as `span` inside the existing `<p>`, separator ` · ` kept as plain text), `.body` via `EditableMarginNote`-style optional handling but plain `p` (add an `optional` mode to `Editable` instead of a new component if simpler: in edit mode always render, `data-placeholder="entry details"`).
- Contact: `contact.heading` via `HeadingEditable`; `contact.blurb` optional Editable (as `p`). The hardcoded "Say hello" kicker is not content-backed; leave it.
- Footer: `footer.note` (as `p`... note the current markup wraps note in `<p>`; keep it), links via `EditableLink` inside the existing `li` structure.

- [ ] **Step 1: Write the failing tests**

`tests/editable.test.tsx` (jsdom pragma). Render `Editable` inside a test harness that provides the editor context (export the raw context object from `EditProvider.tsx` for tests, or render through `EditProvider` with mocked actions). Cover, with mutation evidence where marked:
1. View mode renders exactly `<p class="x">text</p>` with NO extra attributes: assert `container.innerHTML` equals the hand-written expected string. **(mutation: add a stray `data-editable` in view mode; test must fail)**
2. View mode with `children` renders the children, not the raw text.
3. View mode with empty text renders nothing.
4. Edit mode renders `contenteditable="true"`, `role="textbox"`, `data-editable`.
5. Paste of `"one\ntwo\u0000three"` inserts `onetwothree` as plain text and never HTML. **(mutation: remove the control-char strip; must fail)**
6. Enter triggers blur and one `saveField` call; the call carries `{ path, value, updatedAt }` from context.
7. Unchanged blur calls `saveField` zero times.
8. Failed save (`{ ok: false, error: 'stale' }`) restores the previous text into the element and reports the stale message. **(mutation: skip the restore; must fail)**
9. Escape restores text and saves nothing.
10. `EditableLink` view mode innerHTML matches the current anchor markup exactly; edit mode click on the anchor does not navigate (spy `preventDefault`).

Run to verify FAIL, then implement, then PASS. Record the three mutation-evidence failures in the report.

- [ ] **Step 2: Integrate into the six section files**

Follow the integration map. After each file, run `npm test` (the existing section tests, `highlight.test.tsx`, `reveal.test.tsx`, `written-heading.test.tsx`, must stay green).

- [ ] **Step 3: Server markup identity proof**

With the dev server running (fallback seed content is fine):

```bash
curl -s http://localhost:3000 > /tmp/after.html
git stash && curl -s http://localhost:3000 > /tmp/before.html && git stash pop
```

Do NOT use that stash flow if it conflicts with unstaged work; instead check out the pre-task commit into a temp worktree for the before-capture. Diff the two `<main>` bodies; the ONLY acceptable differences are none. If the diff is non-empty, the integration changed public markup: fix before proceeding. Also `curl -s http://localhost:3000 | grep -ci 'contenteditable\|data-editable'` must print `0`.

- [ ] **Step 4: Full gates and commit**

Run: `npm test && npx tsc --noEmit && npm run check:mobile` (dev server for check:mobile per its script).

```bash
git add components/editor components/sections components/shell/Footer.tsx app/globals.css tests/editable.test.tsx
git commit -m "feat: in-place Editable fields across every section, view markup unchanged"
```

---

### Task 6: Array operations UI (products, track entries, tags)

**Files:**
- Create: `components/editor/ArrayControls.tsx`, `lib/editor/templates.ts`
- Modify: `components/sections/Products.tsx`, `components/sections/Tracks.tsx`
- Test: `tests/editor-templates.test.ts`, `tests/array-controls.test.tsx`

**Interfaces:**
- Consumes: `saveArray` from `@/app/actions/content`; `useEditor`, `saveErrorMessage` from EditProvider; `Content`, `contentSchema` from schema.
- Produces:
  - `lib/editor/templates.ts`: `newProduct(existingIds: string[]): Content['products'][number]` returning `{ id, name: 'New product', tagline: 'What it promises', body: 'What it is and why it matters.', tags: [], links: [] }`; `newTrackEntry(existingIds: string[]): Content['tracks'][number]['entries'][number]` returning `{ id, org: 'Organization', role: 'Role', period: 'Present', body: '' }`; `uniqueId(prefix: string, taken: string[]): string` returning the first `${prefix}-${n}` (n from 1) not in `taken` (no randomness, no Date).
  - `ArrayControls({ kind, items, index, arrayKey }: { kind: 'product' | 'entry' | 'tag'; items: unknown[]; index: number; arrayKey: string })` rendering, in edit mode only, a compact button row: remove (labelled `Remove ${kind}`), move up, move down (disabled at the ends), and on the LAST item's row an add button. Tags get only remove + a trailing add. Every button `min-h-11 min-w-11`, `aria-label`ed, theme tokens, no tilt.

**Behavior:** each operation builds the whole next array (splice copy), then for products/tags calls `saveArray({ key: 'products', value: nextProducts, updatedAt })` (tags live inside products, so a tag op sends the whole products array with one product's tags changed); for entries `saveArray({ key: 'tracks.${trackIndex}.entries', ... })`. On ok: `setUpdatedAt`, `reportStatus saved`, `router.refresh()`. On failure: `reportStatus` with mapped message (no DOM to revert; refresh() re-syncs).

Removal asks `window.confirm` first for products and entries (destructive), not for tags.

- [ ] **Step 1: Failing template tests**

`tests/editor-templates.test.ts`:
1. `newProduct([])` and `newTrackEntry([])` each pass their zod sub-schema (import `productSchema` / `trackEntrySchema`).
2. `uniqueId('product', ['product-1', 'product-2'])` returns `'product-3'`; `uniqueId('x', [])` returns `'x-1'`.
3. Appending `newProduct` to the seed's products keeps the whole doc schema-valid via `applyArrayChange`.

Run → FAIL → implement → PASS.

- [ ] **Step 2: Failing control tests**

`tests/array-controls.test.tsx` (jsdom): in edit mode, remove on products index 0 with confirm=true calls `saveArray` with the array minus item 0; move down on index 0 swaps 0 and 1; add appends a template item; confirm=false saves nothing; in view mode the component renders `null`. Run → FAIL → implement → PASS.

- [ ] **Step 3: Integrate into Products and Tracks**

Controls render adjacent to each card/entry/tag inside the existing structure. View-mode markup must remain byte-identical (controls render `null` outside edit mode; re-run the Task 5 Step 3 curl checks: `grep -ci 'contenteditable\|data-editable\|Remove product'` on the logged-out page must print `0`).

React keys: product cards currently key by `product.id`, tags by tag text; with tags editable, change the tag key to the index (`key={j}`) in the same commit that makes them editable, if Task 5 has not already.

- [ ] **Step 4: Full gates and commit**

Run: `npm test && npx tsc --noEmit`

```bash
git add components/editor/ArrayControls.tsx lib/editor/templates.ts components/sections tests/editor-templates.test.ts tests/array-controls.test.tsx
git commit -m "feat: add, remove, and reorder for products, work entries, and tags"
```

---

### Task 7: End-to-end suite and mobile gate

**Files:**
- Create: `e2e/editor.spec.ts`, `e2e/helpers/session.ts`
- Modify: none expected (`playwright.config.ts` already runs everything in `e2e/`; the prod config's testMatch must NOT pick up the editor spec against the live site: check `playwright.prod.config.ts` and exclude `editor.spec.ts` there if its testDir would include it)
- Test: this task IS tests.

**Preconditions (check, do not assume):**
- `node --env-file=.env.local scripts/check-auth-env.mjs` must show `AUTH_SECRET: set`, `ADMIN_GITHUB_LOGIN: set`, `DATABASE_URL: set`. If `DATABASE_URL` is set but the database rejects it (the known stale-password state), the save-persistence tests will fail at their precondition step with a clear message; report BLOCKED to the controller rather than weakening the tests. The DOM-purity tests run regardless.

- [ ] **Step 1: Session helper `e2e/helpers/session.ts`**

```ts
import { encode } from 'next-auth/jwt'

/**
 * Forges a valid Auth.js session cookie the way Auth.js itself would mint
 * it (same JWE encoding, same HKDF salt = cookie name). This tests OUR
 * authorization checks: the actions must accept only a token whose login
 * is the admin. It deliberately does not exercise GitHub's OAuth screens.
 */
export const SESSION_COOKIE = 'authjs.session-token'

export async function forgeSessionCookie(login: string): Promise<{
  name: string
  value: string
  domain: string
  path: string
  httpOnly: boolean
  sameSite: 'Lax'
}> {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET missing from the environment; run via node --env-file or export it')
  const value = await encode({
    token: { login, name: 'E2E', sub: 'e2e-user' },
    secret,
    salt: SESSION_COOKIE,
  })
  return { name: SESSION_COOKIE, value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }
}
```

Playwright loads env from the shell; run the suite as `node --env-file=.env.local node_modules/.bin/playwright test e2e/editor.spec.ts` or export the vars via the webServer env passthrough. Document the working invocation in the report and add an npm script `"e2e:editor": "node --env-file=.env.local node_modules/.bin/playwright test e2e/editor.spec.ts"` if it proves needed.

- [ ] **Step 2: Write `e2e/editor.spec.ts`**

Suites, in this order:

```
test.describe('visitor DOM purity')
  - load /: expect zero [contenteditable], zero [data-editable], no text
    'Revert last save', no 'Edit page' control, in the full page DOM
  - disable JavaScript (browser context javaScriptEnabled: false): all five
    section headings and the hero name still render as text
  - load /login logged out: sign-in card, and the page carries
    noindex robots meta

test.describe('non-admin session is refused')
  - forge cookie for login 'someone-else', set hint in localStorage, load /:
    toolbar never appears (getEditorState refuses), and the hint is cleared

test.describe('admin editing round-trip')   // requires working DATABASE_URL
  - precondition: request getEditorState via the UI path: forge admin cookie
    (login from process.env.ADMIN_GITHUB_LOGIN), set localStorage
    'bgm-editor' = '1' before load, reload; if the toolbar does not appear,
    fail with 'editor state unavailable: check DATABASE_URL in .env.local'
  - toggle Edit page; click the about heading; select-all; type a marker
    value 'E2E heading <run-scoped suffix from testInfo.workerIndex>';
    press Enter; expect the aria-live region to show Saved
  - reload without edit mode: the new heading text is in the server HTML
  - click Revert last save (accept the confirm dialog): expect Saved status;
    reload: the original heading text is back in the server HTML
  - stale-write: open two pages on one context in edit mode; save in page A;
    then save in page B without reloading; expect page B to surface the
    'page changed elsewhere' message and the field to revert

test.describe('mobile toolbar')
  - iPhone 14 project only: admin cookie + hint, toolbar visible, then
    assert document.documentElement.scrollWidth <= window.innerWidth
```

Use accessible selectors (`getByRole`) throughout. The editing tests restore every change they make (the revert IS part of the test), so the suite leaves the database as it found it even on the live content doc; still, they run only against the local dev server, never production.

- [ ] **Step 3: Run and stabilize**

Run: dev e2e suite (`npm run e2e` invocation for just this spec first, then the whole dev suite). Expected: purity + non-admin suites PASS everywhere; round-trip suite PASS with a valid `DATABASE_URL`, otherwise BLOCKED per preconditions.

- [ ] **Step 4: Mobile gate**

Run: `npm run check:mobile` (visitor view; overflow count must be 0). The admin-view scrollWidth assertion in the spec covers the toolbar case.

- [ ] **Step 5: Commit**

```bash
git add e2e/editor.spec.ts e2e/helpers/session.ts package.json
git commit -m "test: editor e2e for purity, authorization, persistence, revert, and staleness"
```

---

### Task 8: Rollout, graceful degradation proof, docs

**Files:**
- Create: `docs/EDITOR.md`
- Modify: `docs/superpowers/PLAN-2-HANDOFF.md` (status note at top), `README.md` if one exists (check first)

- [ ] **Step 1: Graceful degradation proof**

In a shell WITHOUT the auth env vars (run the build with only `DATABASE_URL` absent too, matching a cold clone): `npm run build` must succeed; `npm run start`, then:
- `curl -s http://localhost:3000 | grep -c 'Environmental Protection Specialist'` → at least 1 (seed fallback serves).
- `curl -s http://localhost:3000/login` → contains "not configured".
- The page contains zero editor traces (same greps as Task 5).
Kill the server. Record outputs in the report.

- [ ] **Step 2: Write `docs/EDITOR.md`**

Contents, concretely:
- How editing works day to day: visit `/login`, sign in with GitHub, land on `/?edit=1`, use the pencil toolbar; edits save on blur; Revert undoes the last save (pressing it again redoes); sign out from the toolbar.
- The one-time production setup checklist for Bryan (this is the ONLY part a human must do):
  1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App. Homepage `https://bryangmills.com`, callback `https://bryangmills.com/api/auth/callback/github`. This is a SECOND app; the localhost one stays for development.
  2. In Vercel → project `personal_website` → Settings → Environment Variables (Production): add `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` from that new app, and `AUTH_URL` = `https://bryangmills.com`. (`AUTH_SECRET` and `ADMIN_GITHUB_LOGIN` are already there.)
  3. Redeploy (any push, or Vercel's Redeploy button).
  4. Visit `https://bryangmills.com/login` and sign in.
- Local dev needs: `.env.local` with the rotated `DATABASE_URL`, the dev OAuth app's `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`, `AUTH_SECRET`, `ADMIN_GITHUB_LOGIN=bmills23`.
- Troubleshooting: "Not authorized" means the GitHub account is not `ADMIN_GITHUB_LOGIN`; "page changed elsewhere" means reload; editor absent means the hint is unset (visit `/?edit=1`) or `getEditorState` cannot reach the database.

- [ ] **Step 3: Update the handoff**

Add at the top of `docs/superpowers/PLAN-2-HANDOFF.md`: a dated note that Plan 2 shipped, pointing at `docs/EDITOR.md` and this plan file, and correcting the one stale instruction inside it (`updateTag` from a route handler is impossible; the shipped design uses Server Actions).

- [ ] **Step 4: Final gates and commit**

Run: `npm test && npx tsc --noEmit && npm run check:mobile` and the dev e2e suite one more time.

```bash
git add docs/EDITOR.md docs/superpowers/PLAN-2-HANDOFF.md
git commit -m "docs: editor guide, production OAuth checklist, handoff correction"
```

---

## Decisions locked by this plan

| Decision | Rationale |
|---|---|
| Server Actions, not `POST /api/content` | `updateTag` throws in route handlers (verified in installed Next source); actions give read-your-writes plus built-in origin checks |
| No `proxy.ts` middleware | Spec already mandates per-route session re-checks; keeping auth off the public request path removes a failure mode and the rename hazard |
| `updatedAt` is an opaque `updated_at::text` token | Timestamp reformatting in JS is where equality checks silently die |
| Whole-document revalidation on every save | `contentSchema` is the single source of truth; per-field length checks would be a second, driftable copy |
| Editor hint in localStorage, session checked only when hinted | Visitors never trigger an auth request; Bryan's browser remembers it is his |
| Revert = swap with newest history row | Nothing is ever lost; pressing revert twice is undo/redo |
| No UI for `hero.highlights` | They are match phrases, not display text; the API supports the paths, the UI omits them in v1 |
| Hardcoded hero margin note and "Say hello" kicker stay non-editable | Not content-backed today; making them so is a schema change out of scope |
| Forged-JWT e2e sessions | Tests OUR authorization boundary; GitHub's OAuth screens are Auth.js's tested territory |
| Real-Postgres coverage via the e2e round-trip, not a separate Neon-branch integration suite | The spec's intent is "the SQL runs against real Postgres"; the e2e save, revert, and two-tab stale tests execute the actual CTEs through the dev server against the local database |
| `signIn` callback AND every action check the admin login | The callback alone does not guard forged/replayed session tokens |

## Out of scope (unchanged known issues)

Resend configuration, GitHub Pages retirement, favicon/OG images, `Icon.tsx` runtime read, rate-limiter counting, history table growth pruning, dark mode.
