import 'server-only'

// Signed, readable tokens: `v1.<payload>.<signature>`.
//
// The payload is base64url JSON and the signature an HMAC-SHA256 of it, so a
// token proves who issued it without hiding what it says. Never put anything
// secret in the claims.
//
// Shared by the admin session (lib/auth/admin-session.ts) and the user session
// (lib/auth/user-session.ts). They sign with different secrets, but that alone
// is not what stops one being presented as the other: the user session also
// labels its key (lib/auth/user-session.ts's signingKey()), so the separation
// no longer depends on operators choosing different values for
// USER_SESSION_SECRET and ADMIN_SESSION_SECRET.

const VERSION = 'v1'

const encoder = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
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

export async function signToken(secret: string, claims: object): Promise<string> {
  const payload = b64url(encoder.encode(JSON.stringify(claims)))
  return `${VERSION}.${payload}.${await hmac(secret, payload)}`
}

/**
 * The claims of a token this secret signed, or null for anything else:
 * missing, malformed, another version, or a signature that does not match.
 *
 * Expiry is deliberately the caller's job — the two sessions expire by
 * different rules.
 */
export async function verifyToken(
  secret: string,
  token: string | undefined,
): Promise<Record<string, unknown> | null> {
  if (!token) return null

  const [version, payload, signature] = token.split('.')
  if (version !== VERSION || !payload || !signature) return null

  if (!safeEqual(signature, await hmac(secret, payload))) return null

  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return claims && typeof claims === 'object' && !Array.isArray(claims)
      ? (claims as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
