import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/admin-session'
import { updateRewardSchema } from '@/lib/schemas/catalog'
import { parseJsonBody } from '@/lib/schemas/common'
import { getRewardForAdmin } from '@/lib/supabase/reads'
import { updateReward } from '@/lib/supabase/writes'

type Context = { params: Promise<{ id: string }> }

async function parseRewardId(context: Context): Promise<number | null> {
  const { id: rawId } = await context.params
  const id = Number(rawId)
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * GET /api/catalog/rewards/[id] — admin only.
 *
 * One reward, active or not, to fill app/admin/rewards/[id]/edit/page.tsx.
 */
export async function GET(_request: NextRequest, context: Context) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'ต้องเข้าสู่ระบบเจ้าหน้าที่ก่อน' }, { status: 403 })
  }

  const id = await parseRewardId(context)
  if (id === null) {
    return NextResponse.json({ error: 'รหัสของรางวัลไม่ถูกต้อง' }, { status: 400 })
  }

  try {
    const reward = await getRewardForAdmin(id)
    if (!reward) {
      return NextResponse.json({ error: 'ไม่พบของรางวัลนี้' }, { status: 404 })
    }
    return NextResponse.json({ success: true, reward })
  } catch (error) {
    console.error('[catalog/rewards] read failed:', error)
    return NextResponse.json({ error: 'ไม่สามารถโหลดของรางวัลได้' }, { status: 500 })
  }
}

/**
 * PATCH /api/catalog/rewards/[id] — admin only.
 *
 * Persists the on/off switch on app/admin/rewards/page.tsx (`{ isActive }`),
 * which used to flip React state only — the reward stayed live for users and
 * the switch reset on reload — and the edits from
 * app/admin/rewards/[id]/edit/page.tsx. Only the fields sent are changed.
 */
export async function PATCH(request: NextRequest, context: Context) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'ต้องเข้าสู่ระบบเจ้าหน้าที่ก่อน' }, { status: 403 })
  }

  const id = await parseRewardId(context)
  if (id === null) {
    return NextResponse.json({ error: 'รหัสของรางวัลไม่ถูกต้อง' }, { status: 400 })
  }

  const parsed = await parseJsonBody(request, updateRewardSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    // A variable reward's `points` is its redemption floor (see CASH_REWARD_ID
    // in lib/rewards-catalog.ts), not a price — the editor shows it read-only.
    if (parsed.data.points !== undefined) {
      const current = await getRewardForAdmin(id)
      if (!current) {
        return NextResponse.json({ error: 'ไม่พบของรางวัลนี้' }, { status: 404 })
      }
      if (current.isVariable) {
        return NextResponse.json(
          { error: 'ไม่สามารถแก้ไขคะแนนของรางวัลที่กำหนดจำนวนเองได้' },
          { status: 400 },
        )
      }
    }

    const found = await updateReward(id, parsed.data)
    if (!found) {
      return NextResponse.json({ error: 'ไม่พบของรางวัลนี้' }, { status: 404 })
    }
    return NextResponse.json({ success: true, id, ...parsed.data })
  } catch (error) {
    console.error('[catalog/rewards] update failed:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถบันทึกของรางวัลได้ กรุณาลองใหม่' },
      { status: 500 },
    )
  }
}
