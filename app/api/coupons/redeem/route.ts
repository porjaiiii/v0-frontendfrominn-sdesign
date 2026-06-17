/**
 * POST /api/coupons/redeem
 *
 * แลกคะแนนเป็นรางวัล แล้วสร้าง coupon ใหม่เก็บใน Google Sheet
 *
 * Request body:
 * {
 *   user_id          : string   — LINE userId ของผู้แลก (required)
 *   reward_id        : number   — รหัส reward template (required)
 *   reward_name      : string   — ชื่อรางวัล (required)
 *   reward_description: string  — คำอธิบายรางวัล (required)
 *   reward_image     : string   — URL รูปรางวัล (required)
 *   points_used      : number   — คะแนนที่ใช้แลก (required)
 *   tx_id            : string   — รหัส points transaction อ้างอิง (optional)
 *   expires_at       : string   — ISO datetime หมดอายุ (optional)
 * }
 *
 * Response 200:
 * {
 *   success : true
 *   coupon  : CouponRecord
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { COUPON_SCRIPT_URL, type CouponRecord } from '@/lib/coupon-config'

function generateCouponId(): string {
  const hex = () => Math.random().toString(16).substring(2, 10).toUpperCase()
  return `CPN${hex()}-${hex().substring(0, 4)}-${hex().substring(0, 4)}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      user_id,
      reward_id,
      reward_name,
      reward_description,
      reward_image,
      points_used,
      tx_id,
      expires_at,
    } = body

    // ── Validate required fields ──────────────────────────────────────────
    if (!user_id || !reward_id || !reward_name || !reward_description || !reward_image || !points_used) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['user_id', 'reward_id', 'reward_name', 'reward_description', 'reward_image', 'points_used'],
        },
        { status: 400 }
      )
    }

    if (typeof points_used !== 'number' || points_used <= 0) {
      return NextResponse.json(
        { error: 'points_used must be a positive number' },
        { status: 400 }
      )
    }

    // ── Build coupon record ───────────────────────────────────────────────
    const coupon: CouponRecord = {
      coupon_id: generateCouponId(),
      user_id,
      reward_id: Number(reward_id),
      reward_name,
      reward_description,
      reward_image,
      points_used: Number(points_used),
      tx_id: tx_id ?? '',
      status: 'active',
      redeemed_at: new Date().toISOString(),
      used_at: '',
      expires_at: expires_at ?? '',
      scanned_by: '',
    }

    // ── Send to Google Apps Script ────────────────────────────────────────
    const payload = {
      action: 'createCoupon',
      type: 'insert',
      ...coupon,
    }

    const response = await fetch(COUPON_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[coupons/redeem] GAS error:', errorText.substring(0, 500))
      return NextResponse.json(
        { error: 'Failed to save coupon to Google Sheet', details: errorText.substring(0, 200) },
        { status: 500 }
      )
    }

    const result = await response.json()
    console.log('[coupons/redeem] Coupon created:', coupon.coupon_id, '| GAS result:', result)

    return NextResponse.json({ success: true, coupon })
  } catch (error) {
    console.error('[coupons/redeem] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to redeem coupon', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
