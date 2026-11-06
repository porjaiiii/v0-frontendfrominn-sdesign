import { NextRequest, NextResponse } from 'next/server'

import { clearSession } from '@/lib/auth/user-session'
import { getLineIdentity } from '@/lib/auth/verify-line-token'

// The user session's own endpoint (lib/auth/user-session.ts).
//
// There is no "log in" here: any request carrying a fresh LINE ID token starts
// or refreshes the session inside getLineIdentity(). This route exists for the
// two things the client cannot do itself, because the cookie is httpOnly —
// ask whether it has a usable session, and end it.

const NO_STORE = { 'Cache-Control': 'no-store' } as const

/**
 * GET /api/session → { lineUserId, expiresAt } | 401
 *
 * hooks/use-liff.ts asks this at startup and on resume. With a fresh ID token
 * attached it also starts the session, so the cookie exists before the token's
 * hour is up. `expiresAt` is null when sessions are switched off
 * (USER_SESSION_SECRET unset) and the identity came from the token alone.
 */
export async function GET(request: NextRequest) {
  const identity = await getLineIdentity(request)
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  return NextResponse.json(
    { lineUserId: identity.lineUserId, expiresAt: identity.session?.expiresAt ?? null },
    { headers: NO_STORE },
  )
}

/** DELETE /api/session — log out of the API. LIFF's own logout is the client's job. */
export async function DELETE() {
  await clearSession()
  return NextResponse.json({ success: true }, { headers: NO_STORE })
}
