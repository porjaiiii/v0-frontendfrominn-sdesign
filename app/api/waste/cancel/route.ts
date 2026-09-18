import { NextRequest, NextResponse } from 'next/server'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { isMaintenance, MAINTENANCE_MESSAGE } from '@/lib/maintenance'
import { parseJsonBody } from '@/lib/schemas/common'
import { cancelWasteSchema } from '@/lib/schemas/waste'
import { cancelWaste, WriteError } from '@/lib/supabase/writes'

/**
 * POST /api/waste/cancel — remove a cart item the user added by mistake.
 *
 * Scoped to records still `pending`. A record that has been confirmed has
 * already moved points, carbon and account aggregates, and undoing that is a
 * ledger reversal rather than a delete — this answers 409 and leaves it alone.
 *
 * The owner comes from the verified token, so the body cannot name a victim:
 * somebody else's record is a 404 here, the same as one that does not exist.
 *
 * No Idempotency-Key, unlike its neighbours: cancelling twice is not a
 * duplicate to suppress, it is the same single outcome.
 */
export async function POST(request: NextRequest) {
  if (isMaintenance()) {
    return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 })
  }

  const identity = await getLineIdentity(request)
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJsonBody(request, cancelWasteSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    await cancelWaste(identity.lineUserId, parsed.data.timestamp)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof WriteError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('[waste/cancel] supabase write failed:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถลบรายการได้ กรุณาลองใหม่' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  return POST(request)
}
