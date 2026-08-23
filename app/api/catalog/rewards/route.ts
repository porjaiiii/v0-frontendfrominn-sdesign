import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/admin-session'
import { CATALOG_REWARDS } from '@/lib/rewards-catalog'
import { createRewardSchema } from '@/lib/schemas/catalog'
import { parseJsonBody } from '@/lib/schemas/common'
import { getRewardsCatalog } from '@/lib/supabase/reads'
import { createReward } from '@/lib/supabase/writes'

/**
 * GET /api/catalog/rewards
 *
 * Live rewards from app.rewards, replacing the static REWARDS array in
 * lib/waste-data.ts that app/rewards/page.tsx and app/admin/rewards/page.tsx
 * both read directly. A reward the admin POSTs below now actually shows up
 * here — without this, that write would have gone into a table nothing ever
 * reads back.
 *
 * Falls back to lib/rewards-catalog.ts (the same offline list app.redeem_rewards'
 * GAS branch already prices from) on any DB error.
 */
export async function GET() {
  try {
    const rewards = await getRewardsCatalog()
    if (rewards.length > 0) {
      return NextResponse.json({ success: true, rewards, isFallback: false })
    }
  } catch (error) {
    console.error('[catalog/rewards] falling back to static catalog:', error)
  }

  const rewards = CATALOG_REWARDS.map((reward) => ({
    id: reward.id,
    name: reward.name,
    description: reward.description,
    points: reward.points,
    image: reward.image,
    isVariable: reward.isVariable,
    minPoints: reward.minPoints,
    stock: null,
  }))

  return NextResponse.json({ success: true, rewards, isFallback: true })
}

/**
 * POST /api/catalog/rewards — admin only.
 *
 * The write side of app/admin/rewards/new/page.tsx, which used to
 * `// TODO: POST to GAS / API route` and simply sleep for 800ms.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'ต้องเข้าสู่ระบบเจ้าหน้าที่ก่อน' }, { status: 403 })
  }

  const parsed = await parseJsonBody(request, createRewardSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    const reward = await createReward(parsed.data)
    return NextResponse.json({ success: true, reward })
  } catch (error) {
    console.error('[catalog/rewards] create failed:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถเพิ่มของรางวัลได้ กรุณาลองใหม่' },
      { status: 500 },
    )
  }
}
