import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/admin-session'
import { setRewardActiveSchema } from '@/lib/schemas/catalog'
import { parseJsonBody } from '@/lib/schemas/common'
import { setRewardActive } from '@/lib/supabase/writes'

/**
 * PATCH /api/catalog/rewards/[id] — admin only.
 *
 * Persists the on/off switch on app/admin/rewards/page.tsx, which used to flip
 * React state only — the reward stayed live for users and the switch reset on
 * reload.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'ต้องเข้าสู่ระบบเจ้าหน้าที่ก่อน' }, { status: 403 })
  }

  const { id: rawId } = await context.params
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'รหัสของรางวัลไม่ถูกต้อง' }, { status: 400 })
  }

  const parsed = await parseJsonBody(request, setRewardActiveSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    const found = await setRewardActive(id, parsed.data.isActive)
    if (!found) {
      return NextResponse.json({ error: 'ไม่พบของรางวัลนี้' }, { status: 404 })
    }
    return NextResponse.json({ success: true, id, isActive: parsed.data.isActive })
  } catch (error) {
    console.error('[catalog/rewards] toggle failed:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถเปลี่ยนสถานะของรางวัลได้ กรุณาลองใหม่' },
      { status: 500 },
    )
  }
}
