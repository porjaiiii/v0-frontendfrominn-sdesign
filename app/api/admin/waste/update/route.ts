import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/admin-session'
import { isMaintenance, MAINTENANCE_MESSAGE } from '@/lib/maintenance'
import { parseJsonBody, readIdempotencyKey } from '@/lib/schemas/common'
import { adminUpdateWasteSchema } from '@/lib/schemas/waste'
import { confirmWaste, WriteError } from '@/lib/supabase/writes'

// PUT /api/admin/waste/update — staff confirm (or edit and confirm) a pending
// record in somebody else's cart.
//
// The ONLY way to confirm a record. Users cannot confirm or edit their own —
// /api/waste/update is retired and answers 403, because it took the weight
// from the owner's own request and so let anyone award themselves points.
// This takes the owner from the body (a staff member's LINE token is never
// who gets credited) and is gated on an admin session. app.confirm_waste
// underneath awards the points to that owner exactly once.
//
// Callers: <WasteCart admin /> via WasteCard and WasteDetailModal.
export async function PUT(request: NextRequest) {
  if (isMaintenance()) {
    return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 })
  }

  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJsonBody(request, adminUpdateWasteSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    const result = await confirmWaste(
      parsed.data.user_id,
      parsed.data,
      readIdempotencyKey(request),
    )

    // Same shape as /api/waste/update, so the clients read one response.
    return NextResponse.json({
      success: true,
      data: {
        id: result.record.id,
        timestamp: result.record.timestamp,
        user_id: result.record.user_id,
        waste_type: result.record.waste_type,
        weight_kg: result.record.weight_kg,
        carbon_reduction: result.record.carbon_reduction,
        points_earned: result.record.points_earned,
        points_awarded: result.pointsAwarded,
        already_confirmed: result.alreadyConfirmed,
        tx_id: result.txId,
      },
    })
  } catch (error) {
    if (error instanceof WriteError) {
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการบันทึกขยะกรุณาลองใหม่', details: error.message },
        { status: error.status },
      )
    }
    console.error('[admin/waste/update] supabase write failed:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกขยะกรุณาลองใหม่' },
      { status: 500 },
    )
  }
}
