# Editor guide

**Written:** 2026-07-28, for Plan 2 (the browser editor).

This is the owner's guide to editing bryangmills.com in place. For the
implementation plan, see `docs/superpowers/plans/2026-07-28-personal-website-editor.md`.
For the state Plan 2 was built on, see `docs/superpowers/PLAN-2-HANDOFF.md`.

## Day to day

1. Visit `/login` and sign in with GitHub.
2. A successful sign-in redirects to `/?edit=1`, which sets a local
   "remember this browser is the owner's" hint and lands back on the page.
3. A floating toolbar appears in the bottom-right corner with four controls:
   - **Edit page** toggles edit mode on and off.
   - **Revert last save** swaps the current document for the previous
     history row, after a confirm prompt. Pressing it again swaps back, so
     it works as undo/redo.
   - **Sign out** signs out and forgets the local hint.
   - A status line (next to the buttons) announces "Saving" / "Saved" or an
     error message.
4. With editing on, click into any heading or paragraph to edit its text
   in place. Saves happen on blur (click or tab away). Enter commits and
   blurs; Escape restores the last saved text and blurs.
5. Product cards, work-track entries, and tags have add/remove/reorder
   controls next to them while editing (the plus button, the x, and the
   up/down arrows). These write the whole array at once, not a single
   field.
6. If the page says "This page changed elsewhere. Reload before editing,"
   someone (or another tab) saved since this page loaded. Reload and retry.

The toolbar, and every editable control, is invisible to a visitor: it
only renders once the browser has the local hint AND the server confirms
the signed-in GitHub account is the admin login. A first-time visitor's
browser never makes an auth request at all.

## One-time production setup

This is the only part that needs a human, and only once. Everything else
above works the moment this is done.

1. GitHub: Settings -> Developer settings -> OAuth Apps -> New OAuth App.
   - Homepage URL: `https://bryangmills.com`
   - Authorization callback URL: `https://bryangmills.com/api/auth/callback/github`
   - This is a **second** OAuth app. The existing one (localhost) stays in
     place for local development; a GitHub OAuth app accepts exactly one
     callback URL, so one app cannot serve both.
2. Vercel: project `personal_website` -> Settings -> Environment Variables,
   set for **Production**:
   - `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` from the new app.
   - `AUTH_URL` = `https://bryangmills.com`
   - `AUTH_SECRET` and `ADMIN_GITHUB_LOGIN` are already set; leave them.
3. Redeploy (any push to `main`, or Vercel's Redeploy button).
4. Visit `https://bryangmills.com/login` and sign in.

Until this is done, `/login` reads "Editor not configured" and the public
site is unaffected; see "Graceful degradation" below.

## Local development

`.env.local` (gitignored) needs:

- `DATABASE_URL`: the rotated Neon connection string.
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`: from the dev GitHub OAuth app
  (callback `http://localhost:3000/api/auth/callback/github`).
- `AUTH_SECRET`: any random string, shared with the contact-form IP hash.
- `ADMIN_GITHUB_LOGIN=bmills23`

See `.env.example` for the full variable list including the ones the
editor does not use.

## Troubleshooting

- **"Not authorized."** on `/login`: signed in with a GitHub account other
  than `ADMIN_GITHUB_LOGIN`. Sign out of GitHub or use a different account.
- **"Not saved: that value is not allowed."**: the field failed schema
  validation (usually too long). Shorten it and retry.
- **"This page changed elsewhere. Reload before editing."**: the document
  changed since this page loaded (another tab, or a direct database edit).
  Reload the page.
- **Toolbar and editable controls don't appear**: either the local hint
  isn't set (visit `/?edit=1` while signed in to set it), or
  `getEditorState` couldn't reach the database (a session exists but
  `loadCurrent()` returned nothing). Check `DATABASE_URL` and Neon status.
- **"Editor not configured"** on `/login`: one of `AUTH_GITHUB_ID`,
  `AUTH_GITHUB_SECRET`, `AUTH_SECRET`, or `ADMIN_GITHUB_LOGIN` is missing
  from the environment. In production this means the one-time setup above
  has not been done yet.
- **Fields aren't editable (clicking does nothing) in Firefox**: editable
  fields use `contentEditable="plaintext-only"`, which needs Firefox 136+;
  older Firefox versions silently fail to make the field editable. Chrome
  and Safari support it at any recent version.

## If you lose control of your session

If you believe an editor session has been compromised (a stolen laptop or
browser profile, a leaked cookie, anything where someone else might be able
to act as the signed-in owner), in order of what to do:

1. **Rotate `AUTH_SECRET` in Vercel** (project `personal_website` ->
   Settings -> Environment Variables). Auth.js signs every session with
   this value, so changing it invalidates every existing session
   immediately, everywhere, with no way for an already-issued cookie to
   keep working. Redeploy (or wait for Vercel to pick up the new value) for
   it to take effect. Side effect: `lib/contact/rateLimit.ts`'s `hashIp`
   falls back to `AUTH_SECRET` as its salt whenever `CONTACT_IP_SALT` is
   not set, so rotating `AUTH_SECRET` also changes every `ip_hash` going
   forward, which is indistinguishable from every contact-form sender's
   rate-limit bucket resetting at once. Set `CONTACT_IP_SALT` (see
   `.env.example`) ahead of time if you want to rotate `AUTH_SECRET`
   without that side effect.
2. **Clear or change `ADMIN_GITHUB_LOGIN`** (same Vercel settings page) to
   disable editing entirely: `authConfigured()` (`lib/auth/index.ts`)
   requires it, so an empty or wrong value makes `/login` read "Editor not
   configured" and every save attempt fail, for anyone, until it is set
   back correctly. Useful as an immediate kill switch if step 1 alone
   feels insufficient or you cannot get to Vercel's OAuth settings quickly.
3. **Revoke the OAuth app's grant in GitHub**: GitHub Settings ->
   Applications -> Authorized OAuth Apps, find this site's app, and revoke
   access. This is the step that actually matters if a whole browser
   profile was stolen (not just a session cookie): steps 1 and 2 stop the
   *site* from trusting anything, but the attacker's browser may still be
   able to complete a fresh GitHub OAuth sign-in on their own if they also
   have your GitHub session; revoking the grant forces a real GitHub
   re-authentication (and, if you suspect your GitHub account itself is
   compromised, handle that separately - this only revokes this one app's
   access).

Content damage (not the session itself) is separately recoverable: every
save writes to the `content_history` table before it is applied, and the
toolbar's **Revert last save** button steps back through it one save at a
time (see "Day to day" above). A rotated `AUTH_SECRET`/cleared
`ADMIN_GITHUB_LOGIN` does not touch this table, so reverting unwanted
changes can happen either before or after locking the session down.

## Graceful degradation

The public site never depends on the editor. Verified 2026-07-28 by moving
`.env.local` aside (so no database or auth environment variables were
present at all, matching a cold clone) and running `npm run build` then
`npm run start` against that env-less state. Three results were observed:

- The home page rendered full seed content (the database read fails
  cleanly and falls back to `seed/content.json`).
- `/login` showed the "Editor not configured" card instead of erroring.
- The rendered page carried zero editor traces: no `contenteditable`, no
  `data-editable` attributes, no toolbar.
