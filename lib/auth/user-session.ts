import 'server-only'

import { cookies } from 'next/headers'

import { signToken, verifyToken } from './signed-token'

// The user's session: proof of a LINE login that outlives LINE's one-hour ID
// token.
//
// LIFF hands out an ID token that lives one hour inside a login that lives
// twelve, and cannot renew it without navigating the whole page through LINE.
// Every route used to demand that token on every request, so an hour after
// opening the app everything answered 401 — and the only fix was a redirect
// that threw away whatever the user was doing. Now getLineIdentity()
// (lib/auth/verify-line-token.ts) verifies the token and records the result
// here, in a cookie whose lifetime is ours to choose.
//
// Stateless on purpose: the cookie carries everything and nothing is stored.
// `sid` exists so a sessions table — for revocation, or listing a user's
// active logins — can be added later without logging anyone out: give it a
// row keyed by sid instead of reissuing every outstanding cookie.

export const USER_SESSION_COOKIE = 'dwa_session'

/** A session dies after this long without use… */
export const IDLE_TTL_SECONDS = 12 * 60 * 60
/** …is reissued once it is this old, so steady use never reaches that… */
export const RENEW_AFTER_SECONDS = 6 * 60 * 60
/** …and cannot outlive the LINE login that started it by more than this. */
export const ABSOLUTE_TTL_SECONDS = 7 * 24 * 60 * 60

export interface UserSession {
  /** Random id of this login. Survives renewal; a new login gets a new one. */
  sid: string
  /** The LINE user id — app.users.line_user_id. */
  sub: string
  /** When this copy of the cookie was issued (unix seconds). */
  iat: number
  /** When it stops being accepted (unix seconds). */
  exp: number
  /** When LINE last vouched for `sub` (unix seconds). The 7-day limit counts from here. */
  auth: number
}

/**
 * Set once this process has logged the secret's status, so a value read on
 * every request logs at most once rather than on every one of them.
 */
let loggedSecretStatus = false

function secret(): string | null {
  const value = process.env.USER_SESSION_SECRET?.trim()

  if (!loggedSecretStatus) {
    loggedSecretStatus = true
    if (value && value.length < 32) {
      console.error(
        '[user-session] USER_SESSION_SECRET is set but under 32 characters — ' +
          'sessions are OFF; every request needs a fresh LINE ID token.',
      )
    } else if (!value && process.env.NODE_ENV === 'production') {
      // Not an error outside production: tests and local dev routinely run
      // with no secret at all, and that is the supported Bearer-only mode.
      console.warn(
        '[user-session] USER_SESSION_SECRET is not set — ' +
          'sessions are OFF; every request needs a fresh LINE ID token.',
      )
    }
  }

  return value && value.length >= 32 ? value : null
}

/**
 * The HMAC key user sessions are signed with. Labelled, so a session token can
 * never verify as an admin token (lib/auth/admin-session.ts) — not even if
 * USER_SESSION_SECRET and ADMIN_SESSION_SECRET are set to the same value, when
 * a user could otherwise replay their own dwa_session cookie as dwa_admin.
 */
function signingKey(): string | null {
  const key = secret()
  return key ? `dwa_session:${key}` : null
}

/**
 * Whether sessions are switched on. Without a usable USER_SESSION_SECRET no
 * cookie is issued or accepted and getLineIdentity() falls back to the ID
 * token alone — how the app behaved before sessions existed — rather than
 * failing.
 */
export function userSessionsEnabled(): boolean {
  return secret() !== null
}

const nowSeconds = () => Math.floor(Date.now() / 1000)

function newSid(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url')
}

/** A session for a user LINE vouched for at `at`. Pass `sid` to keep the same login's id. */
export function startSession(
  sub: string,
  sid: string = newSid(),
  at: number = nowSeconds(),
): UserSession {
  return { sid, sub, iat: at, exp: at + IDLE_TTL_SECONDS, auth: at }
}

/** The same login slid forward: new iat and exp, same sid, sub and auth. */
export function renewSession(session: UserSession, at: number = nowSeconds()): UserSession {
  return {
    ...session,
    iat: at,
    exp: Math.min(at + IDLE_TTL_SECONDS, session.auth + ABSOLUTE_TTL_SECONDS),
  }
}

/** Old enough that the next request should reissue it. */
export function isDueForRenewal(session: UserSession, at: number = nowSeconds()): boolean {
  return at - session.iat >= RENEW_AFTER_SECONDS
}

/**
 * LINE vouched long enough ago that a fresh ID token should restart the
 * session — resetting the 7-day limit — rather than leave it as is.
 */
export function isDueForReauth(session: UserSession, at: number = nowSeconds()): boolean {
  return at - session.auth >= RENEW_AFTER_SECONDS
}

export async function encodeSession(session: UserSession): Promise<string | null> {
  const key = signingKey()
  return key ? signToken(key, session) : null
}

/** The session in a cookie value, or null if it is missing, forged, malformed or expired. */
export async function decodeSession(
  token: string | undefined,
  at: number = nowSeconds(),
): Promise<UserSession | null> {
  const key = signingKey()
  if (!key || !token) return null

  const claims = await verifyToken(key, token)
  if (!claims) return null

  const { sid, sub, iat, exp, auth } = claims
  if (typeof sid !== 'string' || !sid || typeof sub !== 'string' || !sub) return null
  if (typeof iat !== 'number' || typeof exp !== 'number' || typeof auth !== 'number') return null
  // The 7-day limit is enforced here too, not only when exp is computed, so a
  // cookie cannot outlive it whatever its exp claims.
  if (exp <= at || auth + ABSOLUTE_TTL_SECONDS <= at) return null

  return { sid, sub, iat, exp, auth }
}

/** This request's session, or null. Never throws: a broken cookie is no cookie. */
export async function readSession(): Promise<UserSession | null> {
  if (!userSessionsEnabled()) return null
  try {
    const store = await cookies()
    return await decodeSession(store.get(USER_SESSION_COOKIE)?.value)
  } catch (error) {
    console.error('[user-session] could not read the session cookie:', error)
    return null
  }
}

/**
 * Sets the cookie on this response. Never throws: failing to persist a session
 * leaves the request exactly as authenticated as it already was.
 */
export async function writeSession(session: UserSession): Promise<void> {
  try {
    const token = await encodeSession(session)
    if (!token) return

    const store = await cookies()
    store.set(USER_SESSION_COOKIE, token, {
      httpOnly: true,
      // Page scripts must not be able to read it: that is what makes it safer
      // to hold than the ID token LIFF keeps in web storage.
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: Math.max(0, session.exp - nowSeconds()),
    })
  } catch (error) {
    console.error('[user-session] could not set the session cookie:', error)
  }
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(USER_SESSION_COOKIE)
}
