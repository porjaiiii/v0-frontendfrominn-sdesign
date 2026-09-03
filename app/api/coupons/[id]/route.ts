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

import { getAdminSession } from '@/lib/auth/admin-session'
import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { getCouponById } from '@/lib/supabase/reads'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: coupon_id } = await context.params

    if (!coupon_id) {
      return NextResponse.json({ error: 'Missing coupon_id' }, { status: 400 })
    }

    const coupon = await getCouponById(coupon_id)
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
  } catch (error) {
    console.error('[coupons/[id]] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch coupon', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
