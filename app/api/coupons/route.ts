/**
 * GET /api/coupons?user_id=xxx
 *
 * ดึงรายการ coupon ทั้งหมดของ user คนหนึ่ง
 *
 * Query params:
 *   user_id   string   (required) — LINE userId
 *   status    string   (optional) — กรองตาม status: 'active' | 'used' | 'expired'
 *
 * Response 200:
 * {
 *   success : true
 *   coupons : CouponRecord[]
 *   total   : number
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { COUPON_SCRIPT_URL, type CouponRecord } from '@/lib/coupon-config'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const status  = searchParams.get('status')   // optional filter

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    const scriptUrl = new URL(COUPON_SCRIPT_URL)
    scriptUrl.searchParams.set('action', 'getCoupons')
    scriptUrl.searchParams.set('user_id', user_id)
    if (status) scriptUrl.searchParams.set('status', status)

    const response = await fetch(scriptUrl.toString())

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[coupons] GET error:', errorText.substring(0, 500))
      return NextResponse.json(
        { error: 'Failed to fetch coupons from Google Sheet', details: errorText.substring(0, 200) },
        { status: 500 }
      )
    }

    const result = await response.json()

    // GAS ควร return { status: 'success', data: CouponRecord[] }
    if (result.status === 'success') {
      const coupons: CouponRecord[] = result.data ?? []
      return NextResponse.json({ success: true, coupons, total: coupons.length })
    }

    // GAS ส่ง error กลับมา
    console.error('[coupons] GAS returned error:', result.message)
    return NextResponse.json(
      { error: result.message ?? 'Unexpected response from Google Sheet' },
      { status: 500 }
    )
  } catch (error) {
    console.error('[coupons] GET unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch coupons', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
