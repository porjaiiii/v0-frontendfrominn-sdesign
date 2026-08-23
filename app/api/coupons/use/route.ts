import { NextRequest, NextResponse } from 'next/server'
import { COUPON_SCRIPT_URL, type CouponRecord } from '@/lib/coupon-config'

import { requireAdmin } from '@/lib/auth/admin-session'
import { backendFor, isMaintenance, MAINTENANCE_MESSAGE } from '@/lib/backend-flags'
import { POINTS_SCRIPT_URL } from '@/lib/points-config'
import { parseJsonBody } from '@/lib/schemas/common'
import { useCouponSchema } from '@/lib/schemas/points'
import { useCoupon, WriteError } from '@/lib/supabase/writes'

/**
 * Supabase path — a single compare-and-swap.
 *
 * Two staff scanning the same QR simultaneously: exactly one 200, one 409.
 * GAS scanned the sheet to find the row, checked its status, then wrote — with
 * the read and the write in separate operations and no lock
 * (line-oa/Code.gs:243-264), so both scans could pass the check.
 *
 * The spend_details flip that app/coupon-confirm/[id]/page.tsx made afterwards
 * as a separate best-effort call is now part of the same transaction.
 */
async function respondFromSupabase(request: NextRequest, scannedBy: string) {
  if (isMaintenance()) {
    return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 })
  }

  const parsed = await parseJsonBody(request, useCouponSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    // scanned_by comes from the verified admin session, not the request — the
    // client used to send whatever it liked, so the audit column recorded a
    // claim rather than a fact.
    const coupon = await useCoupon({ ...parsed.data, scanned_by: scannedBy })
    return NextResponse.json({ success: true, coupon })
  } catch (error) {
    if (error instanceof WriteError) {
      return NextResponse.json(
        {
          error:
            error.status === 404
              ? 'ไม่พบคูปองนี้'
              : error.status === 409
                ? 'คูปองนี้ถูกใช้งานแล้ว'
                : 'ไม่สามารถใช้คูปองได้',
          details: error.message,
        },
        { status: error.status },
      )
    }
    console.error('[coupons/use] supabase update failed:', error)
    return NextResponse.json({ error: 'ไม่สามารถใช้คูปองได้' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // This endpoint had no auth at all: anyone who had seen a QR code — or, before
  // Phase 5, anyone who could guess one, since coupon ids came from
  // Math.random() — could burn somebody else's coupon with one POST.
  //
  // Burning a coupon is a staff action, so it needs a staff session. Checked
  // before the backend split, because the hole is identical on both.
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json(
      { error: 'ต้องเข้าสู่ระบบเจ้าหน้าที่ก่อนใช้คูปอง' },
      { status: 403 },
    )
  }

  if (backendFor('coupons') === 'supabase') {
    return respondFromSupabase(request, admin.sub)
  }

  try {
    const body = await request.json()
    const { coupon_id } = body

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
        scanned_by: admin.sub,
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
      // Moved here from app/coupon-confirm/[id]/page.tsx, which made this call
      // itself. Still two web apps and still best-effort on this backend — it
      // cannot be made atomic against a spreadsheet — but at least the client no
      // longer has to know that, and the Supabase branch does it transactionally.
      const { tx_id, user_id } = result.data ?? {}
      if (tx_id && user_id) {
        try {
          await fetch(POINTS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_spend_used', user_id, tx_id }),
          })
        } catch (syncErr) {
          console.error('[coupons/use] mark_spend_used failed:', syncErr)
        }
      }

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