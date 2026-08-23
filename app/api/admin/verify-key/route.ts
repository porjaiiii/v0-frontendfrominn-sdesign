import { NextRequest, NextResponse } from 'next/server'

import { adminSessionSecretConfigured, setAdminCookie } from '@/lib/auth/admin-session'
import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { activateAdminKey, WriteError } from '@/lib/supabase/writes'

/**
 * POST /api/admin/verify-key — exchange an admin key for a server-side session.
 *
 * What changed: this used to return `{success:true}` and nothing else. The
 * client then wrote `localStorage.admin_session_persistent = 'true'`, and that
 * string was the entire admin gate — no route ever checked anything. It now
 * sets an httpOnly HMAC-signed cookie that page scripts cannot read or forge,
 * and `requireAdmin()` is what actually gates the routes.
 *
 * The caller's identity comes from the verified LINE ID token rather than
 * `body.userId`, so a key cannot be bound to someone else's account. Apps Script
 * did this as an unauthenticated GET that mutated — a verb browsers and
 * crawlers are free to retry and prefetch.
 */
export async function POST(request: NextRequest) {
  try {
    const { adminKey } = await request.json()

    if (!adminKey || typeof adminKey !== 'string') {
      return NextResponse.json({ error: 'adminKey is required' }, { status: 400 })
    }

    // Checked BEFORE the key is touched. app.activate_admin_key binds the key to
    // the caller and cannot be undone from here, so discovering a missing
    // ADMIN_SESSION_SECRET afterwards would burn a single-use key and still
    // answer 500 — the key spent, the admin not logged in, and nothing saying
    // why.
    if (!adminSessionSecretConfigured()) {
      console.error('[admin/verify-key] ADMIN_SESSION_SECRET is not set (or is under 32 chars)')
      return NextResponse.json({ error: 'ADMIN_SESSION_NOT_CONFIGURED' }, { status: 503 })
    }

    const identity = await getLineIdentity(request)
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      await activateAdminKey(adminKey.trim(), identity.lineUserId)
    } catch (error) {
      if (error instanceof WriteError) {
        if (error.code === 'DW004') {
          return NextResponse.json({ error: 'KEY_INVALID' }, { status: 404 })
        }
        if (error.code === 'DW005') {
          return NextResponse.json({ error: 'KEY_TAKEN' }, { status: 403 })
        }
      }
      throw error
    }

    await setAdminCookie(identity.lineUserId)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/verify-key] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
