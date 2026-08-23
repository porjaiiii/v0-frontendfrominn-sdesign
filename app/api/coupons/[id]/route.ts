/**
 * GET /api/coupons/[id] — ดึงข้อมูล coupon เดี่ยวตาม coupon_id
 *
 * Used by the user's own coupon page and by the staff scanner before burning a
 * coupon, so the rule is "the owner, or an admin" rather than either alone.
 *
 * Response 200: { success: true, coupon: CouponRecord }
 *   400 missing id · 403 not yours · 404 not found · 500 backend error
 */

import { NextRequest, NextResponse } from 'next/server'
import { COUPON_SCRIPT_URL, type CouponRecord } from '@/lib/coupon-config'

import { getAdminSession } from '@/lib/auth/admin-session'
import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { backendFor } from '@/lib/backend-flags'
import { getCouponById } from '@/lib/supabase/reads'

async function respondFromSupabase(request: NextRequest, couponId: string) {
  const coupon = await getCouponById(couponId)
  if (!coupon) {
    return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
  }

  // A coupon id is a bearer-ish secret printed in a QR code, so knowing one is
  // not by itself authorisation to read the account it belongs to.
  const [admin, identity] = await Promise.all([getAdminSession(), getLineIdentity(request)])
  const isOwner = identity?.lineUserId === coupon.user_id

  if (!admin && !isOwner) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูคูปองนี้' }, { status: 403 })
  }

  return NextResponse.json({ success: true, coupon })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: coupon_id } = await context.params

    if (!coupon_id) {
      return NextResponse.json({ error: 'Missing coupon_id' }, { status: 400 })
    }

    if (backendFor('coupons') === 'supabase') {
      return await respondFromSupabase(request, coupon_id)
    }

    const scriptUrl = new URL(COUPON_SCRIPT_URL)
    scriptUrl.searchParams.set('action', 'getCoupon')
    scriptUrl.searchParams.set('coupon_id', coupon_id)

    const response = await fetch(scriptUrl.toString())

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[coupons/[id]] GAS error:', errorText.substring(0, 500))
      return NextResponse.json(
        { error: 'Failed to fetch coupon from Google Sheet', details: errorText.substring(0, 200) },
        { status: 500 }
      )
    }

    const result = await response.json()

    if (result.status === 'success' && result.data) {
      const coupon: CouponRecord = result.data

      // Same rule on both backends — this one is not conditional on the flag.
      const [admin, identity] = await Promise.all([getAdminSession(), getLineIdentity(request)])
      if (!admin && identity?.lineUserId !== coupon.user_id) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูคูปองนี้' }, { status: 403 })
      }

      return NextResponse.json({ success: true, coupon })
    }

    const msg: string = (result.message ?? '').toLowerCase()
    const isNotFound =
      msg.includes('not found') ||
      msg.includes('ไม่พบ') ||
      msg.includes('no coupon')

    if (isNotFound) {
      return NextResponse.json({ error: result.message ?? 'Coupon not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: result.message ?? 'Unexpected response from Google Sheet' },
      { status: 500 }
    )
  } catch (error) {
    console.error('[coupons/[id]] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch coupon', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
