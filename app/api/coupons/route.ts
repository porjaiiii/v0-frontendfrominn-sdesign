import { NextRequest, NextResponse } from 'next/server'

import { backendFor } from '@/lib/backend-flags'
import { COUPON_SCRIPT_URL, type CouponRecord } from '@/lib/coupon-config'
import { getCouponById, getCouponsByUser } from '@/lib/supabase/reads'

// GET /api/coupons?coupon_id=...   — single coupon, for the scanner
// GET /api/coupons?user_id=...     — a user's coupons, optionally ?status=
//
// NOTE: this route is unauthenticated, as it is today. Phase 3 locks the
// coupon_id lookup down to verified staff — a coupon id is the QR payload, so
// anyone able to guess one can currently read its full record.

async function couponFromGas(couponId: string) {
  const scriptUrl = new URL(COUPON_SCRIPT_URL)
  scriptUrl.searchParams.set('coupon_id', couponId)

  const response = await fetch(scriptUrl.toString())
  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch from Google Sheet' }, { status: 500 })
  }

  const result = await response.json()
  if (result.status === 'success') {
    return NextResponse.json({ success: true, coupon: result.data })
  }
  return NextResponse.json({ error: result.message || 'Not found' }, { status: 404 })
}

async function couponsFromGas(userId: string, status: string | null) {
  const scriptUrl = new URL(COUPON_SCRIPT_URL)
  scriptUrl.searchParams.set('user_id', userId)

  const response = await fetch(scriptUrl.toString())
  if (!response.ok) {
    const errorText = await response.text()
    console.error('[coupons] GET error:', errorText.substring(0, 500))
    return NextResponse.json(
      { error: 'Failed to fetch coupons from Google Sheet', details: errorText.substring(0, 200) },
      { status: 500 },
    )
  }

  const result = await response.json()
  if (result.status !== 'success') {
    console.error('[coupons] GAS returned error:', result.message)
    return NextResponse.json(
      { error: result.message ?? 'Unexpected response from Google Sheet' },
      { status: 500 },
    )
  }

  let coupons: CouponRecord[] = result.data ?? []
  // GAS returns every status regardless of the request, so the filter runs here.
  if (status) coupons = coupons.filter((cp) => cp.status === status)

  return NextResponse.json({ success: true, coupons, total: coupons.length })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const couponId = searchParams.get('coupon_id')
    const status = searchParams.get('status')

    const useSupabase = backendFor('coupons') === 'supabase'

    // Case 1: the scanner has read a QR code.
    if (couponId) {
      if (!useSupabase) return await couponFromGas(couponId)

      const coupon = await getCouponById(couponId)
      return coupon
        ? NextResponse.json({ success: true, coupon })
        : NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Case 2: every coupon belonging to a user.
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id or coupon_id' }, { status: 400 })
    }

    if (!useSupabase) return await couponsFromGas(userId, status)

    // Filtered in the query rather than after the fact, so unwanted rows never
    // cross the wire.
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
