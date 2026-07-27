# Personal Website Redesign: Design Spec

**Date:** 2026-07-27
**Owner:** Bryan G. Mills
**Repo:** `~/repos/personal_website` (github.com/bmills23/personal_website)
**Status:** Approved, pending implementation plan

---

## 1. Purpose

A personal brand and portfolio site for Bryan G. Mills, positioning him as a person with two
parallel careers: Geologist-in-Training for the State of Colorado, and owner and lead developer
of TerminaLLM LLC, which ships TerminaLLM and Parolejo.

The audience is recruiters, collaborators, and peers. TerminaLLM and Parolejo are the headline
work rather than the subject of the site; this is not a product marketing page.

The site is editable in place by Bryan after logging in with GitHub. No other user has an account.

### Success criteria

1. A visitor understands both careers within one screen of the hero.
2. Both shipped products are presented with real copy and working store links.
3. Bryan can change any text on the site from a browser, without a deploy, in under a minute.
4. The page renders correctly at a true 390x844 mobile viewport with zero horizontal overflow.
5. Link previews on LinkedIn resolve, which requires server-rendered HTML.

### Non-goals

- No blog or writing section.
- No side-project gallery. The GitHub back catalogue (ModelFlow, Mann-Kendall, PLSS Map,
  Neural Numbers, Brewery Finder) is dropped.
- No skill bars with percentage levels. The existing ones invent precision that does not exist.
- No photograph of Bryan in v1.
- No dark mode in v1 (see Decisions).
- No multi-user accounts, roles, or permissions. One editor, forever.

---

## 2. Aesthetic direction

**Field notebook, full expression.** Warm paper, a faint graph grid, a red margin rule, notes in
ink, key phrases struck through with highlighter, cards taped onto the page at slight angles, and
a rotated rubber stamp.

Chosen from four candidate directions (terminal, geological strata, Swiss editorial, field
notebook). The notebook earns the geology connection through fieldwork while staying personal
rather than corporate, and no other developer portfolio looks like it.

Bryan explicitly chose the full-personality calibration over a more restrained one. The
implementation therefore keeps handwriting, tape, stamp, and rotation, and solves their fragility
rather than removing them.

### Palette

| Role | Value | Use |
|---|---|---|
| Paper | `#FBFAF5` | Page background |
| Grid | `#CBD7DD` @ 30% | 18px graph rule, fixed to page |
| Margin rule | `#E8A6A6` | Single vertical line at the left margin |
| Ink | `#16305C` | Headings, wordmark, links |
| Graphite | `#4A5560` | Body copy |
| Pencil | `#6B7683` | Labels, metadata, captions |
| Highlighter | `#F2DC96` | Marker stroke behind key phrases, top edge at 62% |
| Stamp | `#B4453C` | Rubber stamp, section markers, focus rings |
| Card | `#FFFFFF` on `#D9E0E6` | Taped cards |

Pencil was darkened from an earlier `#8A939E`, which measured near 3:1 against paper and failed
WCAG AA for small text. Every foreground and background pairing must be contrast-checked during
implementation rather than judged by eye.

### Typography

All fonts self-hosted as woff2, latin subset, `font-display: swap`, preloaded. No external font
CDN, so there is no third-party request on the critical path.

| Family | Role |
|---|---|
| Fraunces | Display and headings |
| Inter | Body and interface text |
| Caveat | Handwriting, restricted to the wordmark, the stamp, and at most one margin note per section |
| System monospace | Product names and code-shaped text |

Caveat replaces the mockup's `Bradley Hand`, which is macOS-only and would fall back silently and
badly on Android and Windows.

### Motion

Framer Motion, already a dependency. Sections fade and rise on scroll. Tape and cards settle into
their rotation rather than starting rotated. All motion is disabled under
`prefers-reduced-motion`.

### The rotation rule

Card rotation is at most 1.5 degrees, driven by a CSS custom property. At the `sm` breakpoint that
property resolves to `0deg`. Tape and stamp survive at every width; the tilt does not.

Verification is over the Chrome DevTools Protocol using
`Emulation.setDeviceMetricsOverride({width:390,height:844,deviceScaleFactor:2,mobile:true})`,
asserting that no element has `getBoundingClientRect().right > clientWidth`. A narrow desktop
window is not acceptable verification, because headless Chrome enforces a minimum layout viewport
around 500px and produces false overflow.

### Icons

Phosphor Icons (MIT) re-rendered through RoughJS (MIT) into hand-drawn SVG **at build time**, so
the browser receives ordinary static SVG with no runtime cost and no re-render jitter. Each
sketched icon is reviewed by eye, since roughening can muddy fine detail at small sizes.

Brand marks for GitHub, LinkedIn, the App Store, and Google Play come from Simple Icons (CC0) and
stay in their official unsketched form.

---

## 3. Information architecture

1. **Nav.** Caveat wordmark, four links, and a login affordance invisible to visitors. Sticky,
   paper-coloured, hairline bottom border.
2. **Hero.** Kicker ("Entry 001, Denver, Colorado"), name at display size in ink, the two-track
   sentence with company and products highlighted, and a rotated rubber stamp.

   **Unconfirmed:** the stamp reads `EST. 2025` in the mockup, but that founding year was invented
   for the mockup and has not been confirmed. It must be corrected to the real year TerminaLLM LLC
   was formed, or the stamp must be changed to something factual, before launch. Likewise "Denver"
   is assumed from "Colorado" and needs confirming.
3. **About.** Two or three bio paragraphs in graphite, with one handwritten margin note.
4. **Products.** Two taped cards, TerminaLLM and Parolejo, each with tagline, description, tags,
   and store links. Editable and reorderable.
5. **Work, two tracks.** "Track 01 / Science" (State of Colorado) and "Track 02 / Software"
   (TerminaLLM LLC) as parallel columns, stacking on mobile. Entries are addable and editable.
6. **Contact.** Name, email, message, plus a honeypot field.
7. **Footer.** GitHub and LinkedIn, copyright, and a discreet login link.

### Seed content

Product copy is taken from the live sites, both of which are shipped and publicly available, so
cards say "get it" rather than "coming soon".

**TerminaLLM** (terminallm.app): "Your command-line AI, in your pocket." SSH terminal for iOS and
Android with AI coding agents built in. Full xterm-256color terminal, six workspaces (Terminal,
Changes, Files, Assist, Browse, Swarm), Swarm mode for concurrent agents, SFTP browsing with
in-place editing, port forwarding, sessions surviving disconnects, voice-to-command. Free, Plus at
$4.99/mo, Pro at $9.99/mo.

**Parolejo** (parolejo.app): "Saluton! Lernu Esperanton." A fully offline Esperanto course for iOS
and Android. Twelve Zagreb-method lessons, narrator audio with speed control, a 63,000-word ESPDIC
dictionary, flashcard drills. Free, no ads, no accounts, no tracking.

---

## 4. Architecture

### Stack

Next.js App Router on Vercel, replacing the current Vite SPA. Tailwind CSS and Framer Motion carry
over, as does the CSS-variable theme approach in `tailwind.config.js`.

The move off a client-rendered SPA is required, not cosmetic. With content in a database, an SPA
would serve an empty shell and populate it client-side, which yields nothing to the crawlers that
generate LinkedIn link previews.

Migration happens in the existing repo so git history survives.

### Data model (Neon Postgres)

```sql
create table content (
  id         int primary key default 1,
  doc        jsonb not null,
  updated_at timestamptz not null default now(),
  constraint content_singleton check (id = 1)
);

create table content_history (
  id       bigserial primary key,
  doc      jsonb not null,
  saved_at timestamptz not null default now()
);

create table messages (
  id         bigserial primary key,
  name       text not null,
  email      text not null,
  body       text not null,
  ip_hash    text,
  created_at timestamptz not null default now()
);
```

Content is a single JSONB document rather than a table per section. A personal site has roughly
forty editable fields, and a document lets fields be added without a migration.

Schema is created by a checked-in migration file, never by hand in a console.

### Content document shape

Top-level keys: `version`, `hero`, `about`, `products[]`, `tracks[]`, `contact`, `footer`.

`seed/content.json` in the repo defines the starting document **and serves as the fallback** when
Neon is unreachable, so the site never renders blank during a database incident.

### Auth

Auth.js with the GitHub provider. OAuth is not hand-rolled: the state parameter, PKCE, and session
cookie signing are exactly where hand-written auth fails.

- The `signIn` callback rejects any account whose GitHub login is not `ADMIN_GITHUB_LOGIN`
  (`bmills23`).
- Every write route independently re-checks the session, so a bug in one layer is not a breach.
- Session cookie is httpOnly, secure, sameSite.
- Separate OAuth apps for development and production, because a GitHub OAuth app accepts exactly
  one callback URL. A leaked development secret therefore cannot reach production.

### Editing flow

The public page is a server component reading Neon, cached and served statically. A save
invalidates the cache tag, so an edit is live within about a second.

Editable regions use one component throughout:

```jsx
<Editable path="hero.name" as="h1" className="..." />
```

In view mode it renders text. In edit mode it becomes `contentEditable`, with paste intercepted
and flattened to plaintext and Enter handled explicitly, so no foreign HTML can enter the
document. On blur it sends `{path, value, updatedAt}` to `POST /api/content`.

The API:

1. Verifies the session and the admin login.
2. Validates `path` against an **allowlist of known document paths**, so a crafted request cannot
   write arbitrary keys.
3. Length-checks `value`.
4. Rejects the write if `updatedAt` does not match the stored `updated_at` (stale write from a
   second tab), returning a "reload" error rather than clobbering a newer edit.
5. In one transaction: copies the current document to `content_history`, then applies the change
   with `jsonb_set`.

The UI is optimistic, showing "Saving" then "Saved". On failure the field reverts to its previous
text and surfaces the error. Silent failure is not acceptable.

Products and work entries additionally support add, remove, and reorder in edit mode, which send
whole-array operations rather than field paths.

### Contact form

`POST /api/contact` validates fields, checks the honeypot, rate limits by hashed IP (counted
against recent `messages` rows, so no extra service is required), inserts the row, then sends via
Resend.

The row is written before the send is attempted, so a Resend outage cannot lose a message. In
development, mail is printed to the console and no Resend key is needed.

---

## 5. Error handling

| Failure | Behaviour |
|---|---|
| Neon unreachable on page load | Render from `seed/content.json`; log; visitor sees a correct site |
| Save fails | Field reverts to previous text, error shown inline |
| Stale write (two tabs) | Rejected with "this page is out of date, reload" |
| Non-admin GitHub login | Plain "not authorized" page, with no hint it nearly worked |
| Resend outage | Message already persisted; logged; sender still sees success |
| 404 / 500 | Styled as notebook pages, not framework defaults |

---

## 6. Accessibility

- Pencil grey darkened to `#6B7683`; all pairings contrast-checked during implementation.
- Skip link to main content.
- Visible focus rings in stamp red.
- Editable regions labelled and keyboard-reachable in edit mode.
- Graph grid, tape, and stamp marked `aria-hidden`, being decoration.
- Full `prefers-reduced-motion` support.

---

## 7. Testing

Test-first for security-critical logic.

- **Unit:** path allowlist, document schema validation, paste-to-plaintext sanitising, rate
  limiter, honeypot detection, stale-write precondition.
- **Integration:** API routes against a Neon branch. Covers save, history write, unauthorised save
  rejected, malformed path rejected.
- **End to end (Playwright):** log in, edit a field, reload, confirm persistence; submit the
  contact form; confirm a logged-out visitor sees no editing affordances anywhere in the DOM, not
  merely hidden by CSS.
- **Responsive:** CDP script at a true 390x844 viewport asserting an overflow count of zero.

---

## 8. Deployment and environments

Hosting is Vercel. GitHub Pages is turned off once Vercel is live, so no stale duplicate is
indexed. The `gh-pages` script and dependency and `public/.nojekyll` are removed.

### Environment variables

`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`,
`ADMIN_GITHUB_LOGIN`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL`.

### Provisioned

| Resource | Value |
|---|---|
| Neon project | `bryan-personal-site`, id `orange-thunder-55711162`, branch `main`, us-east-2 |
| Domain | `bryangmills.com`, registered via Cloudflare Registrar |
| Local env | `.env.local`, gitignored, `DATABASE_URL` and `AUTH_SECRET` populated |

### Outstanding setup

1. `vercel login`, then link the project.
2. Create the development GitHub OAuth app (callback `http://localhost:3000/api/auth/callback/github`).
3. Create the Resend account and API key. Domain verification is deferred: until then Resend sends
   from `onboarding@resend.dev` and delivers only to the account owner, which is where the contact
   form points anyway.
4. At deploy time, create the production GitHub OAuth app against `bryangmills.com`.
5. At deploy time, point Cloudflare DNS at Vercel using **DNS only** records (grey cloud). Proxying
   Cloudflare in front of Vercel stacks two CDNs and interferes with certificate issuance.

---

## 9. Decisions

| Decision | Rationale |
|---|---|
| Personal brand over founder-first framing | Audience is recruiters and peers, not customers |
| Both careers shown in parallel | Both are current; a chronological list would read as confusing rather than deliberate |
| Full notebook over restrained notebook | Bryan's explicit choice; fragility is solved in code rather than by removing personality |
| No dark mode in v1 | Paper is a light material; a convincing dark palette is a second full design plus doubled QA |
| Inline `contentEditable`, plaintext-only | The requested feel, without the paste and markup hazards of rich `contentEditable` |
| Single JSONB document | Around forty fields; avoids a migration per new field |
| History table instead of draft/publish | Keeps undo, drops the complexity of two content states for a single editor |
| Auth.js over hand-rolled OAuth | State, PKCE, and cookie signing are where hand-written auth fails |
| Next.js over Vite SPA | Server-rendered HTML is required for link previews once content lives in a database |
| Seed file doubles as DB fallback | The site stays up through a database incident for about twenty lines of code |
| Resend domain verification deferred | Not needed while mail is delivered to the account owner |
