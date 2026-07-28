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
npm run migrate       # apply db/migrations against DATABASE_URL
npm run dev
npm test               # unit and integration
npm run e2e:all        # Playwright, dev suite plus the production hydration suite
npm run check:mobile   # CDP overflow check at a true 390x844 viewport
```

Environment lives in `.env.local`, which is gitignored. See the design spec at
`docs/superpowers/specs/2026-07-27-personal-website-design.md`.

## Content

Content is a single JSONB document in the `content` table. `seed/content.json`
is both the starting document and the runtime fallback when the database is
unreachable. The owner can edit the live page in place after signing in at
`/login`; see `docs/EDITOR.md` for day-to-day usage and the one-time
production setup.
