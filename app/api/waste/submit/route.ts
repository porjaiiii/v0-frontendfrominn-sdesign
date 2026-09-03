import { NextRequest, NextResponse } from 'next/server'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { isMaintenance, MAINTENANCE_MESSAGE } from '@/lib/maintenance'
import { parseJsonBody, readIdempotencyKey } from '@/lib/schemas/common'
import { submitWasteSchema } from '@/lib/schemas/waste'
import { submitWaste, WriteError } from '@/lib/supabase/writes'

/**
 * Three things differ from what Apps Script did, all deliberate:
 *
 *   1. Identity comes from the verified LINE ID token, never `body.user_id`.
 *   2. Points and carbon are priced from app.waste_types, so a client cannot
 *      submit its own numbers.
 *   3. An `Idempotency-Key` header makes a retried submit return the ORIGINAL
 *      record with a 200 — never a second row. This is the duplicate-submit
 *      bug that prompted the migration.
 */
async function respondFromSupabase(request: NextRequest) {
  if (isMaintenance()) {
    return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 })
  }

  const identity = await getLineIdentity(request)
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJsonBody(request, submitWasteSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    const { record, duplicate } = await submitWaste(
      identity.lineUserId,
      parsed.data,
      readIdempotencyKey(request),
    )

    return NextResponse.json({
      success: true,
      duplicate,
      data: {
        id: record.id,
        timestamp: record.timestamp,
        user_id: record.user_id,
        waste_type: record.waste_type,
        weight_kg: record.weight_kg,
        carbon_reduction: record.carbon_reduction,
        points_earned: record.points_earned,
        status: record.status,
      },
    })
  } catch (error) {
    if (error instanceof WriteError) {
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการบันทึกขยะกรุณาลองใหม่', details: error.message },
        { status: error.status },
      )
    }
    console.error('[waste/submit] supabase write failed:', error)
    return NextResponse.json(
      {
        error: 'เซิร์ฟเวอร์หนาแน่น กรุณาลองใหม่อีกครั้ง',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return respondFromSupabase(request)
}
