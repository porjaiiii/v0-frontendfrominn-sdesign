import 'server-only'

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

// Server-side verification of the LINE ID token that hooks/use-liff.ts obtains
// via liff.getIDToken().
//
// This is the ONLY place line_user_id becomes trustworthy. Routes must derive
// the id from here and never read it from a request body or query string —
// every write path in the GAS era took the caller's word for who they were,
// which is what made /api/points an open minting endpoint.
//
// Built before any route migrates, so every migrated route is born
// authenticated.

const LINE_ISSUER = 'https://access.line.me'
const LINE_JWKS_URL = new URL('https://api.line.me/oauth2/v2.1/certs')

export interface LineIdentity {
  /** The LINE user id — `sub`. This is app.users.line_user_id. */
  lineUserId: string
  displayName?: string
  pictureUrl?: string
  email?: string
}

export type VerifyResult =
  | { ok: true; identity: LineIdentity }
  | { ok: false; reason: string }

// createRemoteJWKSet keeps its own cache and refetches when it sees an unknown
// `kid`, rate-limited by cooldownDuration. One instance per process.
let jwks: JWTVerifyGetKey | null = null

function getJwks(): JWTVerifyGetKey {
  if (!jwks) {
    jwks = createRemoteJWKSet(LINE_JWKS_URL, {
      cacheMaxAge: 15 * 60 * 1000, // 15 min
      cooldownDuration: 30 * 1000, // don't hammer LINE on a bad kid
      timeoutDuration: 5 * 1000,
    })
  }
  return jwks
}

/** Exposed for tests — drops the cached JWKS so a fresh fetch happens. */
export function resetJwksCache(): void {
  jwks = null
}

/**
 * Verifies a LINE ID token's signature, issuer, audience and expiry.
 *
 * LIFF issues ES256-signed tokens verified against LINE's JWKS. The older
 * server-side token exchange issues HS256 tokens signed with the channel
 * secret; that path is supported only when LINE_CHANNEL_SECRET is set.
 */
export async function verifyLineIdToken(token: string): Promise<VerifyResult> {
  if (!token) return { ok: false, reason: 'MISSING_TOKEN' }

  const channelId = process.env.LINE_CHANNEL_ID
  if (!channelId) return { ok: false, reason: 'LINE_CHANNEL_ID_NOT_CONFIGURED' }

  const options = {
    issuer: LINE_ISSUER,
    audience: channelId,
    clockTolerance: 30, // seconds, for modest device clock drift
  }

  try {
    const alg = decodeAlg(token)

    const { payload } =
      alg === 'HS256'
        ? await jwtVerify(token, hs256Key(), { ...options, algorithms: ['HS256'] })
        : await jwtVerify(token, getJwks(), { ...options, algorithms: ['ES256'] })

    const sub = payload.sub
    if (!sub) return { ok: false, reason: 'MISSING_SUB' }

    return {
      ok: true,
      identity: {
        lineUserId: sub,
        displayName: asString(payload.name),
        pictureUrl: asString(payload.picture),
        email: asString(payload.email),
      },
    }
  } catch (error) {
    // jose codes are stable and safe to surface; the message may not be.
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : 'VERIFY_FAILED'
    return { ok: false, reason: code }
  }
}

function hs256Key(): Uint8Array {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) throw new Error('LINE_CHANNEL_SECRET is required to verify HS256 ID tokens')
  return new TextEncoder().encode(secret)
}

/** Reads `alg` out of the JOSE header without trusting anything else in it. */
function decodeAlg(token: string): string | undefined {
  const header = token.split('.')[0]
  if (!header) return undefined
  try {
    const json = Buffer.from(header, 'base64url').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    if (parsed && typeof parsed === 'object' && 'alg' in parsed) {
      return asString((parsed as { alg: unknown }).alg)
    }
  } catch {
    // Malformed header — let jwtVerify produce the real error.
  }
  return undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** Pulls the token out of an `Authorization: Bearer <token>` header. */
export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

/**
 * Route helper: the verified LINE identity, or null.
 *
 * Always verifies a real ID token against LINE's JWKS — there is no bypass.
 * Local development authenticates through a real LIFF session, same as
 * production, so nothing in the auth path is environment-dependent.
 */
export async function getLineIdentity(request: Request): Promise<LineIdentity | null> {
  const token = getBearerToken(request)
  if (!token) return null

  const result = await verifyLineIdToken(token)
  return result.ok ? result.identity : null
}
