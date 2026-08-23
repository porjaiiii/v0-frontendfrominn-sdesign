// Per-route backend selection, so cutover and rollback are a 30-second env flip
// rather than a deploy.
//
// Every flag defaults to `gas`, which means merging Phase 1 changes nothing in
// any environment until someone deliberately sets a variable.
//
//   BACKEND_DEFAULT=supabase          # flip everything
//   BACKEND_PROFILE=supabase          # ...or one route at a time
//   MAINTENANCE=1                     # freeze window during the prod cutover

export type Backend = 'gas' | 'supabase'

/** The highest-risk routes, the ones worth an independent kill switch. */
export const BACKEND_ROUTES = [
  'profile',
  'register',
  'wasteRecords',
  'wasteSubmit',
  'wasteUpdate',
  'points',
  'coupons',
  'admin',
] as const

export type BackendRoute = (typeof BACKEND_ROUTES)[number]

const ENV_KEYS: Record<BackendRoute, string> = {
  profile: 'BACKEND_PROFILE',
  register: 'BACKEND_REGISTER',
  wasteRecords: 'BACKEND_WASTE_RECORDS',
  wasteSubmit: 'BACKEND_WASTE_SUBMIT',
  wasteUpdate: 'BACKEND_WASTE_UPDATE',
  points: 'BACKEND_POINTS',
  coupons: 'BACKEND_COUPONS',
  admin: 'BACKEND_ADMIN',
}

function parse(value: string | undefined): Backend | null {
  const normalised = value?.trim().toLowerCase()
  if (normalised === 'gas' || normalised === 'supabase') return normalised
  return null
}

/**
 * Which backend serves this route right now.
 *
 * Resolution order: the route's own flag, then BACKEND_DEFAULT, then `gas`.
 *
 * Selecting `supabase` without the connection env vars throws rather than
 * quietly falling back — a silent fallback during cutover means serving stale
 * GAS data while believing you have migrated, which is worse than a 500.
 */
export function backendFor(route: BackendRoute): Backend {
  const resolved = parse(process.env[ENV_KEYS[route]]) ?? parse(process.env.BACKEND_DEFAULT) ?? 'gas'

  if (resolved === 'supabase' && !(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error(
      `${ENV_KEYS[route]} (or BACKEND_DEFAULT) selects supabase, but SUPABASE_URL / ` +
        `SUPABASE_SERVICE_ROLE_KEY are not set.`,
    )
  }

  return resolved
}

/** Freeze window. Routes should refuse writes and serve reads read-only. */
export function isMaintenance(): boolean {
  const value = process.env.MAINTENANCE?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'on'
}

export const MAINTENANCE_MESSAGE =
  'ระบบกำลังปรับปรุงชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่'
