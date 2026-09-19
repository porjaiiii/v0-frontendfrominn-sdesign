import 'server-only'

// Cross-site request forgery guard for cookie-authenticated writes.
//
// A Bearer token has to be attached by our own script, so a request carrying
// one cannot have been forged by another site. A cookie is attached by the
// browser to any request for our origin — including a form another site
// submits. SameSite=Lax already withholds it from cross-site POSTs in current
// browsers; this is the second lock, checked only where the cookie is the
// credential and the request can change something.
//
// Safe methods pass because every GET that reads an identity is read-only:
// Lax does send the cookie on a top-level cross-site navigation, and nothing
// such a navigation can reach changes state.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export type OriginCheck = { ok: true } | { ok: false; reason: string }

/** The host this request was addressed to, as the browser saw it. */
function requestHost(request: Request): string {
  return (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    new URL(request.url).host
  )
}

export function checkSameOrigin(request: Request): OriginCheck {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return { ok: true }

  const origin = request.headers.get('origin')
  if (origin) {
    let originHost: string
    try {
      originHost = new URL(origin).host
    } catch {
      return { ok: false, reason: `unreadable Origin "${origin}"` }
    }
    const host = requestHost(request)
    return originHost === host
      ? { ok: true }
      : { ok: false, reason: `Origin ${origin} is not ${host}` }
  }

  // Older browsers omit Origin on same-origin requests. Fetch metadata is the
  // next best witness when present.
  const site = request.headers.get('sec-fetch-site')
  if (site) {
    return site === 'same-origin' ? { ok: true } : { ok: false, reason: `Sec-Fetch-Site ${site}` }
  }

  // A browser too old to send either. SameSite=Lax is the guard that remains.
  return { ok: true }
}
