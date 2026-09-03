import { NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/auth/admin-session'

/**
 * GET /api/admin/session — is this browser an admin?
 *
 * The client cannot answer this itself any more: the cookie is httpOnly, which
 * is the point. lib/admin-context.tsx asks here on mount instead of reading
 * localStorage, so the UI reflects a decision the server already made.
 */
export async function GET() {
  try {
    const session = await getAdminSession()
    return NextResponse.json(
      { isAdmin: Boolean(session), lineUserId: session?.sub ?? null },
      // Per-browser and cheap to recompute; caching it would leak one admin's
      // answer to the next visitor through any shared cache.
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    // A missing ADMIN_SESSION_SECRET throws. Fail closed.
    console.error('[admin/session] failed:', error)
    return NextResponse.json({ isAdmin: false, lineUserId: null }, { status: 200 })
  }
}
