import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/admin-session'
import { isMaintenance, MAINTENANCE_MESSAGE } from '@/lib/maintenance'
import { parseJsonBody, readIdempotencyKey } from '@/lib/schemas/common'
import { adminSubmitWasteSchema } from '@/lib/schemas/waste'
import { confirmWaste, submitWaste, WriteError } from '@/lib/supabase/writes'

/**
 * POST /api/admin/waste/submit — staff record one weighed item for a user they
 * scanned, and the points are awarded immediately.
 *
 * Submit + confirm back to back. Both halves are replay-safe, so a retry of a
 * request that died between them is harmless: the submit replays the original
 * record (same Idempotency-Key) and the confirm awards exactly once.
 *
 * Identity of the CALLER is the admin cookie; identity of the OWNER is
 * `target_user_id`, which is trusted only because of that cookie. The plain
 * /api/waste/submit route is unchanged and still ignores any user id in a body.
 */
export async function POST(request: NextRequest) {
  if (isMaintenance()) {
    return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 })
  }

  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = await parseJsonBody(request, adminSubmitWasteSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  const { target_user_id: targetUserId, ...input } = parsed.data
  const key = readIdempotencyKey(request)

  try {
    const { record, duplicate } = await submitWaste(targetUserId, input, key)

    const confirmed = await confirmWaste(
      targetUserId,
      // Carries the final values, not just the weight: on a retry the submit
      // above replays the ORIGINAL record, so anything the operator changed
      // since the failed attempt has to land via the confirm.
      {
        timestamp: record.timestamp,
        weight_kg: input.weight_kg,
        waste_type: input.waste_type,
        waste_subtype: input.waste_subtype,
        image_urls: input.image_urls,
        notes: input.notes,
      },
      key ? `${key}:confirm` : null,
    )

    return NextResponse.json({
      success: true,
      duplicate,
      data: {
        id: confirmed.record.id,
        timestamp: confirmed.record.timestamp,
        user_id: confirmed.record.user_id,
        waste_type: confirmed.record.waste_type,
        weight_kg: confirmed.record.weight_kg,
        carbon_reduction: confirmed.record.carbon_reduction,
        points_earned: confirmed.record.points_earned,
        status: confirmed.record.status,
        points_awarded: confirmed.pointsAwarded,
        already_confirmed: confirmed.alreadyConfirmed,
      },
    })
  } catch (error) {
    if (error instanceof WriteError) {
      return NextResponse.json(
        {
          error:
            error.code === '23503'
              ? 'ไม่พบผู้ใช้นี้ในระบบ หรือประเภทขยะไม่ถูกต้อง'
              : 'เกิดข้อผิดพลาดในการบันทึกขยะกรุณาลองใหม่',
          details: error.message,
        },
        { status: error.status },
      )
    }
    console.error('[admin/waste/submit] failed:', error)
    return NextResponse.json({ error: 'เซิร์ฟเวอร์หนาแน่น กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}
