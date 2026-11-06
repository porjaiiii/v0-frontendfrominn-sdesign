'use client'

import { apiFetch } from './api-client'

// The client's view of the user session (lib/auth/user-session.ts).
//
// The cookie is httpOnly, so the only way to learn whether it exists — and
// whose it is — is to ask. hooks/use-liff.ts does that at startup and on
// resume, and decides from the answer whether the user has to go through LINE
// for a fresh ID token.

export type SessionCheck =
  | { status: 'active'; lineUserId: string; expiresAt: number | null }
  /** 401: no usable cookie and no fresh ID token. */
  | { status: 'none' }
  /** Offline, a 5xx, a garbled body — nothing to act on. */
  | { status: 'unknown' }

export async function checkSession(): Promise<SessionCheck> {
  try {
    // apiFetch attaches the ID token while it is fresh, which is what lets
    // this same call create or refresh the session.
    const res = await apiFetch('/api/session', { cache: 'no-store' })
    if (res.status === 401) return { status: 'none' }
    if (!res.ok) return { status: 'unknown' }

    const body: unknown = await res.json()
    if (body && typeof body === 'object' && typeof (body as { lineUserId?: unknown }).lineUserId === 'string') {
      const { lineUserId, expiresAt } = body as { lineUserId: string; expiresAt?: unknown }
      return {
        status: 'active',
        lineUserId,
        expiresAt: typeof expiresAt === 'number' ? expiresAt : null,
      }
    }
    return { status: 'unknown' }
  } catch {
    return { status: 'unknown' }
  }
}

/**
 * Should the app send the user through LINE for a fresh ID token?
 *
 * Yes when the server has no session for us, or has one for a different LINE
 * account than LIFF is signed in as. Never on an unknown answer: redirecting
 * because the network blinked would throw away the page for nothing, and the
 * next request will surface a real problem on its own.
 */
export function needsRelogin(check: SessionCheck, liffUserId: string | null): boolean {
  if (check.status === 'none') return true
  if (check.status === 'active') return liffUserId !== null && check.lineUserId !== liffUserId
  return false
}

/**
 * Ends the session on the server. Bounded, and never throws: logout must not
 * hang on a dead network, and a cookie left behind lapses within 12 hours.
 */
export async function endSession(timeoutMs = 2000): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    await fetch('/api/session', { method: 'DELETE', keepalive: true, signal: controller.signal })
  } catch {
    // Offline or too slow; see above.
  } finally {
    clearTimeout(timer)
  }
}
