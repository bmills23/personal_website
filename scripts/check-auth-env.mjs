// Prints set/MISSING per auth env var, never values. Uses --env-file so the
// shell never sources the file. Run: node --env-file=.env.local scripts/check-auth-env.mjs
const names = ['AUTH_SECRET', 'AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET', 'ADMIN_GITHUB_LOGIN', 'DATABASE_URL']
for (const name of names) {
  console.log(`${name}: ${process.env[name] ? 'set' : 'MISSING'}`)
}
