import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/admin-session'
import { isMaintenance, MAINTENANCE_MESSAGE } from '@/lib/maintenance'
import { parseJsonBody } from '@/lib/schemas/common'
import { adminCancelWasteSchema } from '@/lib/schemas/waste'
import { cancelWaste, WriteError } from '@/lib/supabase/writes'

// POST /api/admin/waste/cancel — staff delete a pending record from somebody
// else's cart.
//
// The staff counterpart to /api/waste/cancel, split rather than widened for
// the same reason as /api/admin/waste/records: that route takes the owner
// from the caller's LINE token, this one takes it from the body and is gated
// on an admin session instead. Same write underneath, so the same rules hold —
// only `pending` records, a confirmed one answers 409.
//
// Callers: <WasteCart admin /> via WasteDetailModal.
export async function POST(request: NextRequest) {
  if (isMaintenance()) {
    return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 })
  }

  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJsonBody(request, adminCancelWasteSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    await cancelWaste(parsed.data.user_id, parsed.data.timestamp)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof WriteError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('[admin/waste/cancel] supabase write failed:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถลบรายการได้ กรุณาลองใหม่' },
      { status: 500 },
    )
  }
}
