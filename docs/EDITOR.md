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

## Graceful degradation

The public site never depends on the editor. Verified by building and
running with none of the editor's environment variables present (see
`.superpowers/sdd/2026-07-28-personal-website-editor/task-8-report.md` for
the exact commands and output):

- `npm run build` and `npm run start` succeed.
- The home page renders full seed content.
- `/login` reads "Editor not configured" instead of erroring.
- The rendered page carries zero editor traces: no `contenteditable`, no
  `data-editable` attributes, no toolbar.
