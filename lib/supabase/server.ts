import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from './types'

// Service-role client, pinned to the `app` schema.
//
// There is no anon client anywhere in this codebase by design: schema `app` is
// the only schema PostgREST serves, nothing grants anon USAGE on it, and every
// table is RLS-deny-all (supabase/migrations/0002_rls.sql). Identity comes from
// a server-verified LINE ID token (lib/auth/verify-line-token.ts), not
// auth.uid(), so routes must derive line_user_id from the token and never from
// the request body.
//
// `server-only` above makes importing this from a client component a build
// error rather than a leaked service-role key.

export type AppClient = SupabaseClient<Database, 'app'>

let cached: AppClient | null = null

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. Run \`supabase start\` and copy the values into .env.local ` +
        `(see .env.example).`,
    )
  }
  return value
}

/**
 * The shared service-role client. Cached per process — creating one per request
 * leaks sockets under load.
 */
export function getServiceClient(): AppClient {
  if (cached) return cached

  cached = createClient<Database, 'app'>(
    required('SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    {
      db: { schema: 'app' },
      auth: {
        // A service-role client has no user session to persist or refresh, and
        // leaving these on makes it try to write to storage that does not exist
        // in a serverless runtime.
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )

  return cached
}

/** True when both env vars are present, so a route can fall back to GAS. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}
