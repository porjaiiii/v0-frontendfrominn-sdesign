import { NextRequest, NextResponse } from 'next/server'

import { getCouponById, getCouponsByUser } from '@/lib/supabase/reads'

// GET /api/coupons?coupon_id=...   — single coupon, for the scanner
// GET /api/coupons?user_id=...     — a user's coupons, optionally ?status=
//
// NOTE: this route is unauthenticated, as it is today. Phase 3 locks the
// coupon_id lookup down to verified staff — a coupon id is the QR payload, so
// anyone able to guess one can currently read its full record.

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const couponId = searchParams.get('coupon_id')
    const status = searchParams.get('status')

    // Case 1: the scanner has read a QR code.
    if (couponId) {
      const coupon = await getCouponById(couponId)
      return coupon
        ? NextResponse.json({ success: true, coupon })
        : NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Case 2: every coupon belonging to a user.
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id or coupon_id' }, { status: 400 })
    }

    // Filtered in the query rather than after the fact, so unwanted rows never
    // cross the wire. Apps Script returned every status regardless of the
    // request and left the filtering to this route.
    const coupons = await getCouponsByUser(userId, status)
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
