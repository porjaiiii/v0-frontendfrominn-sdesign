import 'server-only'

import { cookies } from 'next/headers'

import { signToken, verifyToken } from './signed-token'

// Server-verified admin sessions.
//
// The admin gate used to be `localStorage.admin_session_persistent === 'true'`
// (lib/admin-context.tsx), checked only in the browser. Anyone could type one
// line into devtools and become an admin — and because no route ever checked,
// being an "admin" was purely a UI state that nonetheless unlocked coupon
// scanning and profile lookups.
//
// A session is now an HMAC-signed token in an httpOnly cookie, so it cannot be
// read or forged by page scripts, and `requireAdmin()` is what actually gates
// the routes. The client's isAdmin flag is now just a mirror of what the server
// already decided.

export const ADMIN_COOKIE = 'dwa_admin'

/** 30 days, matching how long the localStorage flag used to persist. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export interface AdminSession {
  /** The LINE user id the admin key was activated for. */
  sub: string
  /** Unix seconds. */
  exp: number
}

/**
 * Whether a usable secret is present, without throwing.
 *
 * Lets a route check the precondition before taking an action it cannot undo —
 * see app/api/admin/verify-key, where activating the key first and discovering
 * the missing secret second spends a single-use key for nothing.
 */
export function adminSessionSecretConfigured(): boolean {
  const value = process.env.ADMIN_SESSION_SECRET?.trim()
  return Boolean(value && value.length >= 32)
}

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET?.trim()
  if (!value || value.length < 32) {
    throw new Error(
      'ADMIN_SESSION_SECRET is not set (or is under 32 chars). Generate one with ' +
        '`openssl rand -base64 48` and put it in .env.local — see .env.example.',
    )
  }
  return value
}

export async function createAdminToken(lineUserId: string): Promise<string> {
  const session: AdminSession = {
    sub: lineUserId,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  }
  return signToken(secret(), session)
}

/**
 * The session in an admin token, or null if it is missing, forged or expired.
 *
 * Throws when ADMIN_SESSION_SECRET is unusable — any non-empty token then has
 * nothing to be checked against. getAdminSession() is the caller that turns
 * that into "not an admin"; call it rather than this from a route.
 */
export async function verifyAdminToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null

  const claims = await verifyToken(secret(), token)
  if (!claims) return null

  const { sub, exp } = claims
  if (typeof sub !== 'string' || !sub || typeof exp !== 'number') return null
  if (exp * 1000 <= Date.now()) return null
  return { sub, exp }
}

/**
 * Reads the session from the request cookie. Null when absent, forged, expired —
 * or when ADMIN_SESSION_SECRET is missing, which must read as "not an admin"
 * rather than as a 500 that a caller might be tempted to treat as transient.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const store = await cookies()
    return await verifyAdminToken(store.get(ADMIN_COOKIE)?.value)
  } catch (error) {
    console.error('[admin-session] verification failed, denying:', error)
    return null
  }
}

export async function setAdminCookie(lineUserId: string): Promise<void> {
  const store = await cookies()
  store.set(ADMIN_COOKIE, await createAdminToken(lineUserId), {
    httpOnly: true,
    // Page scripts must not be able to read this, which was the entire problem
    // with the localStorage flag.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies()
  store.delete(ADMIN_COOKIE)
}

/**
 * Route guard. Returns the session, or null — the caller answers 403.
 *
 * Deliberately separate from getLineIdentity(): being a logged-in LINE user and
 * being staff are different claims, and a coupon must not be burnable just
 * because the caller is signed in.
 */
export async function requireAdmin(): Promise<AdminSession | null> {
  return getAdminSession()
}
