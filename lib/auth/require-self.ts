import 'server-only'

import { getLineIdentity } from '@/lib/auth/verify-line-token'

// Self-access gate for the routes keyed by a LINE user id.
//
// Before this existed, /api/profile/[id], /api/waste/records, /api/coupons and
// GET /api/points answered for ANY id in the query string, with no token at
// all. A LINE user id is not a secret — it travels in QR codes, links and the
// GAS integration — so "knows the id" was never authorisation to read the
// PDPA-regulated row behind it.
//
// The rule is deliberately narrow: the caller proves who they are with a LINE
// ID token, and may read only their own data. Staff who need to read someone
// else's profile go through /api/admin/profile/[id], which is a different
// claim (an admin session) rather than a widened version of this one.

export type SelfAccess =
  | { ok: true; lineUserId: string }
  | { ok: false; status: 401 | 403; error: string }

/**
 * Verifies the bearer token and requires it to match `requestedId`.
 *
 * 401 and 403 are kept distinct on purpose: 401 means "you did not prove who
 * you are" (the client can retry once LIFF has a token), 403 means "you did,
 * and it is not your data" — which no retry fixes and which is worth seeing in
 * the logs.
 */
export async function requireSelf(
  request: Request,
  requestedId: string | null | undefined,
): Promise<SelfAccess> {
  const identity = await getLineIdentity(request)
  if (!identity) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  // No id in the request means "my own data" — the id is taken from the token
  // rather than defaulted to something guessable.
  if (!requestedId) {
    return { ok: true, lineUserId: identity.lineUserId }
  }

  if (requestedId !== identity.lineUserId) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  return { ok: true, lineUserId: identity.lineUserId }
}
