import { NextRequest, NextResponse } from 'next/server'
import { COUPON_SCRIPT_URL, type CouponRecord } from '@/lib/coupon-config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { coupon_id, scanned_by } = body

    if (!coupon_id) {
      return NextResponse.json({ error: 'Missing coupon_id' }, { status: 400 })
    }

    // 🔥 แก้ไขจุดที่ 1: ส่งเป็น POST หา GAS ตรงๆ พร้อมแนบ JSON body ให้ตรงกับ GAS doPost
    const response = await fetch(COUPON_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // ใช้ text/plain เพื่อป้องกันปัญหา CORS/Redirect ของ GAS
      },
      body: JSON.stringify({
        action: 'use', // 🔥 แก้ไขจุดที่ 2: เปลี่ยนจาก 'useCoupon' เป็น 'use' ให้ตรงกับในสคริปต์ GAS
        coupon_id: coupon_id,
        scanned_by: scanned_by ?? '',
      }),
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

    let result: { status?: string; message?: string; data?: CouponRecord }
    try {
      result = await response.json()
    } catch {
      const text = await response.text().catch(() => '')
      console.error('[coupons/use] GAS returned non-JSON:', text.substring(0, 200))
      return NextResponse.json({ error: 'Invalid response from GAS' }, { status: 500 })
    }

    console.log('[coupons/use] GAS result:', JSON.stringify(result))

    // GAS return: { status: 'success', message: '...' }
    if (result.status === 'success') {
      return NextResponse.json({ success: true, coupon: result.data ?? null })
    }

    // Handle specific error codesจาก GAS
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