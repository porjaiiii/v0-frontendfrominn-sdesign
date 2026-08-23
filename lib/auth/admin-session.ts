import 'server-only'

import { cookies } from 'next/headers'

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

const encoder = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return b64url(new Uint8Array(signature))
}

/** Length-independent compare, so a wrong signature leaks nothing by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function createAdminToken(lineUserId: string): Promise<string> {
  const session: AdminSession = {
    sub: lineUserId,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  }
  const payload = b64url(encoder.encode(JSON.stringify(session)))
  return `v1.${payload}.${await sign(payload)}`
}

export async function verifyAdminToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null

  const [version, payload, signature] = token.split('.')
  if (version !== 'v1' || !payload || !signature) return null

  if (!safeEqual(signature, await sign(payload))) return null

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AdminSession
    if (!session.sub || typeof session.exp !== 'number') return null
    if (session.exp * 1000 <= Date.now()) return null
    return session
  } catch {
    return null
  }
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
