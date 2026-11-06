import { NextRequest, NextResponse } from 'next/server'

import { requireSelf } from '@/lib/auth/require-self'
import { getCouponsByUser } from '@/lib/supabase/reads'

// GET /api/coupons?user_id=...  — the caller's own coupons, optionally ?status=
//
// `user_id` must match the LINE ID token, so this lists your coupons and only
// yours.
//
// The ?coupon_id= lookup that used to live here is gone rather than gated: it
// answered for ANY coupon id with no token at all, and a coupon id is the QR
// payload, so holding one was enough to read the record — and the account —
// behind it. /api/coupons/[id] already serves that lookup under the rule it
// actually needs: the owner, or an admin. Nothing in the app called this
// branch; only a test did.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const access = await requireSelf(request, searchParams.get('user_id'))
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    // Filtered in the query rather than after the fact, so unwanted rows never
    // cross the wire. Apps Script returned every status regardless of the
    // request and left the filtering to this route.
    const coupons = await getCouponsByUser(access.lineUserId, status)
    return NextResponse.json({ success: true, coupons, total: coupons.length })
  } catch (error) {
    console.error('[coupons] GET unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch coupons',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
