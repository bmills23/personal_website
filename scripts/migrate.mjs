import { neon } from '@neondatabase/serverless'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Load .env.local first.')
  process.exit(1)
}

// neon(url) and every top-level await below can throw an Error whose message
// embeds the full connection string, credentials included, when the URL is
// malformed (a stray character in the port, a leading space, an unquoted
// shell paste). Node's default uncaught-exception handler prints that
// message to stderr, so this whole block runs inside a try/catch that logs
// only a fixed message plus the error name, matching the same rule already
// applied in lib/content/read.ts and app/api/contact/route.ts: never log the
// raw error object or its message here.
try {
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
    // Splitting on `;` cannot safely handle dollar-quoted blocks (`DO $$ ... $$;`)
    // or semicolons inside string literals: it would silently cut a statement in
    // the wrong place instead of failing. Refuse to run any file that uses
    // dollar-quoting rather than risk mis-splitting it.
    if (body.includes('$$')) {
      console.error(`refuse ${file}: contains dollar-quoting ($$), which this runner cannot split safely`)
      process.exit(1)
    }
    // Neon's HTTP driver runs one statement per call, so split on semicolons at
    // statement boundaries. These migrations contain no semicolons inside literals.
    const statements = body.split(';').map((s) => s.trim()).filter(Boolean)
    // Run every statement in the file, plus the bookkeeping insert, as a single
    // transaction: if any statement fails partway through, nothing in the file
    // commits, so a later run retries from the start of the file rather than
    // replaying already-applied statements against a half-migrated schema.
    await sql.transaction([
      ...statements.map((statement) => sql.query(statement)),
      sql`insert into schema_migrations (name) values (${file})`,
    ])
    console.log(`apply ${file}`)
  }
  console.log('migrations up to date')
} catch (error) {
  console.error(
    'migration failed',
    error instanceof Error ? error.name : 'unknown error',
  )
  process.exit(1)
}
