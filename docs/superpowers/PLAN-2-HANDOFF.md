# Plan 2 Handoff: the browser editor

> **Status update, 2026-07-28: Plan 2 has shipped.** The browser editor
> described below as future work is built and tested on branch
> `plan-2-editor`; merge to `main` follows the final whole-branch review.
> For day-to-day usage and the one-time production OAuth checklist, see
> `docs/EDITOR.md`.
> For the implementation record, see
> `docs/superpowers/plans/2026-07-28-personal-website-editor.md`.
>
> One instruction below is stale and was corrected during implementation:
> "The save API" section (under "What Plan 2 has to build") describes calling
> `updateTag('content')` from a route handler. That is not possible: Next 16
> throws when `updateTag` is called from a Route Handler (verified against
> the installed `next@16.2.12` source). The shipped design uses Server
> Actions instead, which also gives read-your-writes and built-in origin
> checks. Everything else below reflects what was actually built.

**Written:** 2026-07-27, after Plan 1 shipped to production.

Plan 1 built the public site. Plan 2 builds the thing originally asked for: log in with
GitHub, the live page becomes editable in place, click any heading or paragraph and rewrite
it, saves on blur with an undo history.

This file exists because the working ledger lives at
`.superpowers/sdd/2026-07-27-personal-website-foundation/progress.md`, which is **gitignored**
and will not survive a fresh clone. Everything below is what Plan 2 actually needs.

---

## Current production state

| Thing | Value |
|---|---|
| Live site | https://bryangmills.com (also `personalwebsite-ten-phi.vercel.app`) |
| Host | Vercel, project `personal_website`, org `bmills23s-projects`, hobby plan |
| Database | Neon project `bryan-personal-site`, id `orange-thunder-55711162`, branch `main`, us-east-2 |
| DNS | Cloudflare. Apex `A 76.76.21.21`, `www` CNAME `cname.vercel-dns.com`, both **DNS only** (grey cloud) |
| Email | Cloudflare Email Routing, `hello@bryangmills.com` forwards to the owner's Gmail |
| Repo | `main` is the deployed branch; pushes trigger production builds |

**Do not switch nameservers to Vercel.** Cloudflare Email Routing requires Cloudflare DNS, so
that would break `hello@bryangmills.com`.

---

## What is already built for Plan 2

These were built and reviewed during Plan 1 on purpose, so the editor starts on tested ground.

- **`lib/content/paths.ts`** is the security boundary. `isEditablePath(path)` decides what a save
  request may write. It was probed with roughly 70 hostile inputs (prototype chain, unicode
  digits, homoglyphs, trailing newlines, case variants, container prefixes, leading zeros,
  `1e1`/`0x1`) with **no bypass found**. Do not loosen it casually.
  - Exports `EDITABLE_PATTERNS`, patterns with `#` standing for an array index. There is **no**
    `EDITABLE_PATHS` export; it was removed during review as a misleading alias.
  - Per-pattern index caps derive from `ARRAY_LIMITS`, so they cannot desync.
- **`lib/content/schema.ts`** exports `contentSchema`, `type Content`, and `ARRAY_LIMITS`.
  `ARRAY_LIMITS` is the **single source of truth** for array bounds: both the zod `.max()` calls
  and the path index caps read from it. `PATTERN_INDEX_CAPS` throws at module load if a pattern's
  derived key is missing from it, which makes the coupling self-testing.
- **`content_history` table** already migrated, ready for undo.
- **`ADMIN_GITHUB_LOGIN=bmills23`** and **`AUTH_SECRET`** already set in Vercel for Production and
  Preview. `AUTH_SECRET` currently salts the contact-form IP hash and becomes the session key.

---

## What Plan 2 has to build

1. **Auth.js v5** with the GitHub provider. Pin the exact beta (`next-auth@5.0.0-beta.32` was
   current on 2026-07-27); it declares Next 16 support. Do not hand-roll OAuth: state, PKCE, and
   cookie signing are where hand-written auth fails.
   - The `signIn` callback must reject any GitHub login that is not `ADMIN_GITHUB_LOGIN`.
   - Re-check the session in **every** write route, not only in middleware.
   - **Next.js 16 renamed `middleware.ts` to `proxy.ts`.** Auth.js docs show `export { auth as proxy }`.
     [Corrected during implementation: no `proxy.ts` was built. Session
     checks live in each Server Action instead, per this plan's decision
     table ("No `proxy.ts` middleware": keeping auth off the public request
     path removes a failure mode and the rename hazard).]
2. **A production GitHub OAuth app.** A GitHub OAuth app accepts exactly one callback URL, so the
   existing app (localhost, for development) cannot serve production. Create a second one with
   callback `https://bryangmills.com/api/auth/callback/github` and add `AUTH_GITHUB_ID` /
   `AUTH_GITHUB_SECRET` to Vercel. Neither is in Vercel today, deliberately.
3. **The save API.** Order matters:
   1. verify session and admin login
   2. `isEditablePath(path)`
   3. length-check the value
   4. reject if the submitted `updatedAt` does not match the stored `content.updated_at`
      (stale write from a second tab), returning a "reload" error rather than clobbering
   5. in one transaction: copy the current doc into `content_history`, then `jsonb_set`
   6. **call `updateTag('content')`**, see the caching note below
4. **The `Editable` component.** `contentEditable`, plaintext only: intercept paste and flatten to
   text, handle Enter explicitly, so no foreign HTML can enter the document. Optimistic UI with
   Saving / Saved, reverting the field and surfacing the error on failure. Silent failure is not
   acceptable.
5. **Array operations** for products and work entries (add, remove, reorder) as whole-array
   operations rather than path writes.

---

## Caching: the one thing that will confuse you

`getContent()` in `lib/content/read.ts` uses Next 16's `'use cache'` with `cacheTag('content')`,
and **nothing currently invalidates that tag**. `next.config.ts` sets `cacheComponents: true`,
which is what makes the directive legal.

Consequence today: a direct database edit takes roughly fifteen minutes to appear, or is immediate
after a redeploy. The save API must call `updateTag('content')` (Next 16 replaced `unstable_cache`
with `'use cache'` + `cacheTag` + `updateTag`/`revalidateTag`).

Also: the site reads from the database and falls back to `seed/content.json` only when the database
is unreachable. **Editing the seed file does not change the live site.** The database row wins.

---

## Decisions that bind Plan 2

These were settled during Plan 1 and should not be silently revisited.

- **Nav labels are not editable.** They are structural anchors the nav links to by name; letting
  them be renamed from a browser would let the owner break their own navigation.
- **Section headings "Products" and "Work" are not editable** for the same reason. The **kickers**
  are: `sections.products.kicker` and `sections.work.kicker`.
- **The hero heading does not animate.** It is the Largest Contentful Paint element.
- **Highlight phrases are stored as a separate array** (`hero.highlights`), not inline markup, so
  the editable sentence never shows syntax characters like `==`. A phrase that stops matching
  degrades quietly; a test ties the real seed content to it.
- **No dark mode** in v1.
- **Stamp and margin notes keep their tilt at all widths**; the 1.5 degree cap scopes to cards.

---

## Hard rules inherited from Plan 1

- **Never use em dashes (U+2014)** anywhere: code, comments, copy, commit messages.
- **Zero horizontal overflow at a true 390x844 viewport**, verified with `npm run check:mobile`,
  which drives CDP. A narrow desktop window is not acceptable verification.
- **Never log a caught error object wholesale** in code touching the database.
  `@neondatabase/serverless` embeds the full connection string in its error message when the URL
  is malformed. Log a fixed message plus `error.name`.
- **No JavaScript must still mean readable content.** The animation system is CSS gated on a
  `js-ready` class added by an inline `<head>` script, deliberately so the hidden state is never
  server-rendered. Do not move a hidden state into a component's `initial` prop.
- Motion disabled under `prefers-reduced-motion`. Decorative elements `aria-hidden`.
- Theme tokens only. `npx tsc --noEmit` must stay clean. Secrets never enter git.

---

## The lesson worth carrying forward

**Seven assertions in this project passed while being incapable of failing.** A mobile checker that
slept then measured, so it passed on a blank page. A test asserting DOM presence for a CSS
visibility property. A highlighter test that never touched the content it protects. A server-render
test defeated by `<head>` metadata duplicating the string. A substring check satisfied by unrelated
text elsewhere on the page. A `toBeVisible()` call that ignores `opacity`, guarding a bug where
most of the page was invisible without JavaScript.

Not one was caught by reading the test. Every one was caught by breaking the property and checking
whether the test noticed. **For anything security- or correctness-critical in Plan 2, require
mutation evidence: break it, capture the failure, restore, re-run.**

---

## Known issues carried forward, none blocking

- **Resend is not configured.** The contact form honestly returns an error telling senders to email
  directly. Messages are still persisted to Postgres first, so nothing is lost. A *bogus* key is
  worse than none: it makes the route report success while sending nothing.
- **GitHub Pages still serves the old React portfolio.** Retiring it is the last destructive step
  and has been deliberately deferred.
- `components/Icon.tsx` does a runtime `readFileSync` from `public/` under `process.cwd()`. Fine for
  prerendered pages; verify or eliminate before any dynamic rendering. Emitting the SVGs as a
  module from `scripts/build-icons.mjs` would remove the question entirely.
- No favicon and no `openGraph.images`, so link previews render imageless on a site whose
  architecture was chosen for link previews.
- `Hero.tsx` hardcodes a margin note that duplicates `about.heading`; it will drift once that
  becomes editable.
- The rate limiter counts only successfully stored messages, so invalid and honeypot traffic is
  never throttled. The real property is "5 stored messages per hour per IP".
- `x-forwarded-for` leftmost entry may be client-controlled on Vercel; `x-real-ip` is safer.
- No linter. `eslint.config.js` was removed with the Vite stack and nothing replaced it.
- `refs/stash` in this repo holds an unrelated Express project and what looks like another Neon
  credential. Unreachable from any branch, never pushed, and left alone at the owner's request.

---

## Commands

```bash
npm run dev            # dev server
npm test               # vitest, 142 tests
npm run e2e            # Playwright, dev server
npm run e2e:all        # dev suite plus the production hydration suite
npm run check:mobile   # CDP overflow gate at a true 390x844
npm run migrate        # apply db/migrations
npx tsc --noEmit       # must stay clean
```

Design spec: `docs/superpowers/specs/2026-07-27-personal-website-design.md`
Plan 1: `docs/superpowers/plans/2026-07-27-personal-website-foundation.md`
