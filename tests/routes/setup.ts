import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Route tests run against the LOCAL Supabase (`supabase start`). Load
// .env.local the way Next.js would, since vitest does not.
try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (!match) continue
    const [, key, value] = match
    if (!process.env[key]) process.env[key] = value.trim().replace(/^["']|["']$/g, '')
  }
} catch {
  // No .env.local — the guard in each test file reports this properly.
}

// The fixtures INSERT a user with waste records, point lots, transactions and
// coupons, then DELETE it. Against a hosted project that is live data, and
// .env.local points at the hosted project whenever anyone has been running the
// app or the migration scripts. So a non-local SUPABASE_URL is refused here
// rather than trusted: the db-backed tests then fail on their own
// supabaseConfigured() guard, which says to run `pnpm db:start`, and the
// mocked route tests still run.
const url = process.env.SUPABASE_URL
if (url && !/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(url)) {
  console.warn(
    `[tests] Ignoring SUPABASE_URL (${new URL(url).host}): route tests only run ` +
      'against a local Supabase. Run `pnpm db:start` and point .env.local at it.',
  )
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
}

