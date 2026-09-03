import { NextRequest, NextResponse } from 'next/server'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { isMaintenance, MAINTENANCE_MESSAGE } from '@/lib/maintenance'
import { parseJsonBody, readIdempotencyKey } from '@/lib/schemas/common'
import { updateWasteSchema } from '@/lib/schemas/waste'
import { confirmWaste, WriteError } from '@/lib/supabase/writes'

/**
 * One transaction, where Apps Script needed three sequential
 * HTTP calls with a try/catch marked "non-fatal".
 *
 * That comment is the bug: when `earn_points` fails the record is already
 * permanently `done` with zero points, and when the user retries it is awarded
 * a SECOND time. app.confirm_waste does the record update, the point lot, the
 * transaction, the ledger entry and the account aggregates atomically, and
 * awards exactly once no matter how many times it is called.
 */
async function respondFromSupabase(request: NextRequest) {
  if (isMaintenance()) {
    return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 })
  }

  const identity = await getLineIdentity(request)
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJsonBody(request, updateWasteSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    const result = await confirmWaste(
      identity.lineUserId,
      parsed.data,
      readIdempotencyKey(request),
    )

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
        // Same field name the client already reads. It now means "this call
        // awarded the points", so a replay reports false — which is the truth,
        // not a failure.
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
    console.error('[waste/update] supabase write failed:', error)
    return NextResponse.json(
      {
        error: 'เกิดข้อผิดพลาดในการบันทึกขยะกรุณาลองใหม่',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  return respondFromSupabase(request)
}

export async function POST(request: NextRequest) {
  // Redirect POST to PUT
  return PUT(request)
}
