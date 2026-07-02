import { NextRequest, NextResponse } from 'next/server'
import { COUPON_SCRIPT_URL, type CouponRecord } from '@/lib/coupon-config'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const coupon_id = searchParams.get('coupon_id') // 🌟 เพิ่ม: รองรับการดึงข้อมูลรายคูปอง (สำหรับฝั่งเครื่องสแกน)
    const status  = searchParams.get('status')   

    const scriptUrl = new URL(COUPON_SCRIPT_URL)

    // ==========================================
    // เคสที่ 1: เครื่องสแกนส่อง QR code (มี coupon_id ส่งมา)
    // ==========================================
    if (coupon_id) {
      scriptUrl.searchParams.set('coupon_id', coupon_id)
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

    // ==========================================
    // เคสที่ 2: ดึงคูปองทั้งหมดของ User (มี user_id ส่งมา)
    // ==========================================
    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id or coupon_id' }, { status: 400 })
    }

    scriptUrl.searchParams.set('user_id', user_id)
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

    if (result.status === 'success') {
      let coupons: CouponRecord[] = result.data ?? []

      // 🌟 🔥 แก้ไข Hidden Bug: กรองสถานะคูปองให้ตรงตามเงื่อนไขที่ Next.js ส่งมา 
      // เนื่องจากฝั่ง GAS ดึงมาทุกสถานะ เราจึงมา Filter คัดกรองความถูกต้องตรงนี้แทนครับ
      if (status) {
        coupons = coupons.filter((cp: any) => cp.status === status)
      }

      return NextResponse.json({ success: true, coupons, total: coupons.length })
    }

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