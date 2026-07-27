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
