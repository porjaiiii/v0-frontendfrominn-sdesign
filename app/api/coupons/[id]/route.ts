/**
 * GET /api/coupons/[id]
 *
 * ดึงข้อมูล coupon เดี่ยวตาม coupon_id
 * ใช้สำหรับหน้า coupon detail และ scanner ตรวจสอบ coupon ก่อนใช้งาน
 *
 * Path params:
 *   id   string   — coupon_id (เช่น CPNabc123-xxxx-xxxx)
 *
 * Response 200:
 * {
 *   success : true
 *   coupon  : CouponRecord
 * }
 *
 * Error cases:
 *   400  missing id
 *   404  coupon not found
 *   500  GAS error
 */

import { NextRequest, NextResponse } from 'next/server'
import { COUPON_SCRIPT_URL, type CouponRecord } from '@/lib/coupon-config'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: coupon_id } = await context.params

    if (!coupon_id) {
      return NextResponse.json({ error: 'Missing coupon_id' }, { status: 400 })
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
      return NextResponse.json({ success: true, coupon })
    }

    // ตรวจสอบว่า not found หรือ error อื่น
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
