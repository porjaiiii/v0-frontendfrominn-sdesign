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

// These tests exercise the Supabase read paths specifically.
process.env.BACKEND_DEFAULT = 'supabase'
