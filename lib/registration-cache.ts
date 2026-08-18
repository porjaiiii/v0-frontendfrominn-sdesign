// Shared helper for the "is_registered" fast-path cache used by the LIFF
// entry page (app/page.tsx) and the registration form (app/register/page.tsx).
//
// Background: this used to be a plain localStorage boolean with no expiry.
// On iOS, clearing Safari's cache or LINE's app cache does NOT touch
// localStorage belonging to the LIFF WKWebView — it's a separate storage
// container tied to the site's origin. So once 'is_registered' was set to
// 'true', it stayed true forever, even if the underlying DB row was deleted
// (e.g. during testing) or a user's registration was reset. The only fix
// was uninstalling/reinstalling the LINE app.
//
// This version adds a TTL so the cache self-heals: once it expires we
// always re-verify against the database, so a stale flag clears itself
// within TTL_MS instead of persisting indefinitely.

const STORAGE_KEY = 'is_registered'

// How long we trust the cached "registered" flag before re-checking the
// database. Long enough that almost every normal visit skips the API call
// entirely (fast, no loading screen). Short enough that a stale flag heals
// itself within a day without anyone needing to manually clear storage or
// reinstall LINE.
//
// Tune this per environment if needed — e.g. lower it during active testing
// via NEXT_PUBLIC_REGISTERED_CACHE_TTL_MS if you add that env var later.
const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

type CacheShape = { v: true; ts: number }

function isCacheShape(x: unknown): x is CacheShape {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as CacheShape).v === true &&
    typeof (x as CacheShape).ts === 'number'
  )
}

export type RegisteredCacheState =
  | { status: 'fresh' } // registered, verified recently enough to trust as-is
  | { status: 'stale' } // was registered, but should be re-verified against the DB
  | { status: 'empty' } // no cache, or malformed — must verify

/** Reads the cache. Safe to call during SSR (always returns 'empty' server-side). */
export function getRegisteredCache(): RegisteredCacheState {
  if (typeof window === 'undefined') return { status: 'empty' }

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { status: 'empty' }

  // Back-compat: the old format was the plain string 'true' with no
  // timestamp. Treat that as stale so it gets re-verified once and then
  // upgraded to the new shape by setRegisteredCache().
  if (raw === 'true') return { status: 'stale' }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isCacheShape(parsed)) return { status: 'empty' }
    const age = Date.now() - parsed.ts
    return age < TTL_MS ? { status: 'fresh' } : { status: 'stale' }
  } catch {
    return { status: 'empty' }
  }
}

/** Call after a successful registration, or after the DB confirms the user is registered. */
export function setRegisteredCache() {
  if (typeof window === 'undefined') return
  const value: CacheShape = { v: true, ts: Date.now() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

/** Call when the DB confirms the user is NOT registered, to stop trusting a stale flag. */
export function clearRegisteredCache() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}