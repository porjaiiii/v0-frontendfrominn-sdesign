import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/admin-session'
import { isMaintenance, MAINTENANCE_MESSAGE } from '@/lib/maintenance'
import { parseJsonBody } from '@/lib/schemas/common'
import { useCouponSchema } from '@/lib/schemas/points'
import { useCoupon, WriteError } from '@/lib/supabase/writes'

/**
 * A single compare-and-swap.
 *
 * Two staff scanning the same QR simultaneously: exactly one 200, one 409.
 * GAS scanned the sheet to find the row, checked its status, then wrote — with
 * the read and the write in separate operations and no lock
 * (line-oa/Code.gs:243-264), so both scans could pass the check.
 *
 * The spend_details flip that app/coupon-confirm/[id]/page.tsx made afterwards
 * as a separate best-effort call is now part of the same transaction.
 */
async function useCouponAsAdmin(request: NextRequest, scannedBy: string) {
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
  // Burning a coupon is a staff action, so it needs a staff session.
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json(
      { error: 'ต้องเข้าสู่ระบบเจ้าหน้าที่ก่อนใช้คูปอง' },
      { status: 403 },
    )
  }

  return useCouponAsAdmin(request, admin.sub)
}
