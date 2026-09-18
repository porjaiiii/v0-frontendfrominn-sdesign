/**
 * Is this LINE ID token too old to bother sending?
 *
 * LIFF hands out an ID token that lives one hour, inside a session that lives
 * twelve. `liff.isLoggedIn()` tracks the session, so for the other eleven hours
 * it reports a logged-in user while `liff.getIDToken()` returns a token that
 * every route rejects — the client believes it is authenticated and the server
 * answers 401. That mismatch is what this reads.
 *
 * This is a freshness check, NOT verification. The signature is never inspected
 * here and the claim is trivially forgeable; nothing may be trusted on its say-so.
 * The server does the real work in lib/auth/verify-line-token.ts against LINE's
 * JWKS, and remains the only place `sub` becomes a usable identity. The value
 * here is purely in not sending a request we already know will fail.
 *
 * Anything unreadable counts as expired: a token we cannot parse is one the
 * server cannot verify either.
 */

/** Seconds of headroom, so a token cannot die between the check and arrival. */
const EXPIRY_SKEW_SECONDS = 60

export function isIdTokenExpired(
  token: string | null | undefined,
  skewSeconds: number = EXPIRY_SKEW_SECONDS,
): boolean {
  const exp = readExp(token)
  if (exp === null) return true
  return exp - skewSeconds <= Math.floor(Date.now() / 1000)
}

/** The `exp` claim in seconds, or null if the token has no readable one. */
function readExp(token: string | null | undefined): number | null {
  if (!token) return null

  const payload = token.split('.')[1]
  if (!payload) return null

  try {
    // base64url → base64. atob() rejects the url-safe alphabet and requires
    // the padding LINE omits.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const parsed: unknown = JSON.parse(atob(padded))

    if (parsed && typeof parsed === 'object' && 'exp' in parsed) {
      const exp = (parsed as { exp: unknown }).exp
      return typeof exp === 'number' && Number.isFinite(exp) ? exp : null
    }
  } catch {
    // Malformed base64, malformed JSON, non-JSON payload — all unusable.
  }

  return null
}
