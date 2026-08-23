import { NextRequest, NextResponse } from 'next/server'

import { ADMIN_SCRIPT_URL } from '@/lib/admin-config'
import { setAdminCookie } from '@/lib/auth/admin-session'
import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { backendFor } from '@/lib/backend-flags'
import { activateAdminKey, WriteError } from '@/lib/supabase/writes'

/**
 * POST /api/admin/verify-key — exchange an admin key for a server-side session.
 *
 * What changed: this used to return `{success:true}` and nothing else. The
 * client then wrote `localStorage.admin_session_persistent = 'true'`, and that
 * string was the entire admin gate — no route ever checked anything. It now
 * sets an httpOnly HMAC-signed cookie that page scripts cannot read or forge,
 * and `requireAdmin()` gates the routes that matter.
 *
 * On the Supabase backend the caller's identity comes from the verified LINE ID
 * token rather than `body.userId`, so a key cannot be bound to someone else's
 * account.
 */
export async function POST(request: NextRequest) {
  try {
    const { adminKey, userId } = await request.json()

    if (!adminKey || typeof adminKey !== 'string') {
      return NextResponse.json({ error: 'adminKey is required' }, { status: 400 })
    }

    if (backendFor('admin') === 'supabase') {
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
    }

    // GAS path, unchanged in how it verifies — still an unauthenticated GET that
    // mutates on the Apps Script side. It dies with the flag; what is fixed here
    // regardless is what happens with the ANSWER: a signed server session
    // instead of a localStorage boolean.
    const url = new URL(ADMIN_SCRIPT_URL)
    url.searchParams.set('action', 'verifyAdminKey')
    url.searchParams.set('adminKey', adminKey)
    url.searchParams.set('userId', userId ?? '')

    const gasRes = await fetch(url.toString(), { method: 'GET', redirect: 'follow' })

    let result: { status?: string; message?: string; reason?: string }
    try {
      result = await gasRes.json()
    } catch {
      const text = await gasRes.text().catch(() => '')
      console.error('[admin/verify-key] GAS non-JSON:', text.substring(0, 200))
      return NextResponse.json({ error: 'Invalid response from GAS' }, { status: 500 })
    }

    if (result.status === 'success') {
      // Prefer the verified token over body.userId when one is present; the GAS
      // path has no way to insist on it.
      const identity = await getLineIdentity(request)
      await setAdminCookie(identity?.lineUserId ?? userId ?? 'unknown')
      return NextResponse.json({ success: true })
    }

    const reason = result.reason ?? ''

    if (reason === 'KEY_TAKEN') {
      return NextResponse.json({ error: 'KEY_TAKEN' }, { status: 403 })
    }
    if (reason === 'KEY_INVALID') {
      return NextResponse.json({ error: 'KEY_INVALID' }, { status: 404 })
    }
    if (reason === 'MISSING_PARAMS') {
      return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })
    }
    if (reason === 'SHEET_NOT_FOUND') {
      return NextResponse.json({ error: 'SHEET_NOT_FOUND' }, { status: 500 })
    }

    return NextResponse.json({ error: reason || result.message || 'UNKNOWN_ERROR' }, { status: 400 })
  } catch (err) {
    console.error('[admin/verify-key] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
