/**
 * POST /api/coupons/use
 *
 * สแกน QR code แล้วเปลี่ยน status ของ coupon เป็น 'used'
 * ใช้โดยฝั่งเจ้าหน้าที่ / scanner หน้าร้าน
 *
 * Request body:
 * {
 *   coupon_id    : string   — รหัส coupon ที่สแกนได้จาก QR (required)
 *   scanned_by   : string   — LINE userId / staff ID ของผู้สแกน (optional)
 * }
 *
 * Response 200:
 * {
 *   success  : true
 *   coupon   : CouponRecord   — record ที่อัปเดตแล้ว
 * }
 *
 * Error cases:
 *   400  missing coupon_id
 *   404  coupon not found
 *   409  coupon already used / expired
 *   500  GAS error
 */

import { NextRequest, NextResponse } from 'next/server'
import { COUPON_SCRIPT_URL, type CouponRecord } from '@/lib/coupon-config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { coupon_id, scanned_by } = body

    if (!coupon_id) {
      return NextResponse.json({ error: 'Missing coupon_id' }, { status: 400 })
    }

    // GAS Web App ไม่รองรับ JSON POST โดยตรง (จะ redirect ไป Google login)
    // ใช้ GET + query string แทนเหมือนกับ route อื่น ๆ ในโปรเจกต์นี้
    const scriptUrl = new URL(COUPON_SCRIPT_URL)
    scriptUrl.searchParams.set('action', 'useCoupon')
    scriptUrl.searchParams.set('coupon_id', coupon_id)
    scriptUrl.searchParams.set('scanned_by', scanned_by ?? '')
    scriptUrl.searchParams.set('used_at', new Date().toISOString())

    const response = await fetch(scriptUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[coupons/use] GAS error:', errorText.substring(0, 500))
      return NextResponse.json(
        { error: 'Failed to update coupon in Google Sheet', details: errorText.substring(0, 200) },
        { status: 500 }
      )
    }

    const result = await response.json()

    // คาดว่า GAS จะ return: { status: 'success', data: CouponRecord }
    // หรือ { status: 'error', message: '...' }
    if (result.status === 'success') {
      const coupon: CouponRecord = result.data
      console.log('[coupons/use] Coupon marked used:', coupon_id)
      return NextResponse.json({ success: true, coupon })
    }

    // Handle specific error codes from GAS
    const msg: string = (result.message ?? '').toLowerCase()

    if (msg.includes('not found') || msg.includes('ไม่พบ')) {
      return NextResponse.json({ error: result.message ?? 'Coupon not found' }, { status: 404 })
    }

    if (msg.includes('already used') || msg.includes('ใช้งานแล้ว') || msg.includes('expired') || msg.includes('หมดอายุ')) {
      return NextResponse.json({ error: result.message ?? 'Coupon already used or expired' }, { status: 409 })
    }

    return NextResponse.json(
      { error: result.message ?? 'Unexpected GAS response' },
      { status: 500 }
    )
  } catch (error) {
    console.error('[coupons/use] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to use coupon', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
