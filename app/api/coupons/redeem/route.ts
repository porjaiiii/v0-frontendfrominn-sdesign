/**
 * POST /api/coupons/redeem — แลกคะแนนเป็นรางวัลและออกคูปอง
 *
 * Request body (Phase 5 shape):
 * {
 *   items       : [{ reward_id: number, quantity?: number, points?: number }]
 *   redeem_type : 'pickup' | 'delivery'   (optional, default 'pickup')
 * }
 *
 * `points` is honoured ONLY for a variable-price reward (the cash-back coupon)
 * and is floored server-side. For every other reward the price comes from the
 * catalog and the request cannot influence it.
 *
 * The legacy single-reward body — {reward_id, reward_name, points_used, …} — is
 * still accepted and mapped onto the new shape, so a browser running an older
 * bundle keeps working across a deploy. Its `points_used` is read as a
 * variable-reward amount and otherwise discarded.
 *
 * Response 200: { success: true, tx_id, points_used, coupon, coupons[] }
 *   `coupon` is the first coupon, preserved for existing callers that read a
 *   single object. One coupon is minted per unit.
 */

import { NextRequest, NextResponse } from 'next/server'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { isMaintenance, MAINTENANCE_MESSAGE } from '@/lib/maintenance'
import { parseJsonBody, readIdempotencyKey } from '@/lib/schemas/common'
import { redeemRequestSchema, type RedeemRewardsInput } from '@/lib/schemas/points'
import { redeemRewards, WriteError } from '@/lib/supabase/writes'

// ---------------------------------------------------------------------------
// One transaction: price, spend, mint.
//
// Apps Script did this as two calls to two web apps with no transaction between
// them — the spend could succeed and the mint fail, taking the points and
// handing back nothing. That is the structural reason this route was migrated
// rather than repaired.
// ---------------------------------------------------------------------------

async function respondFromSupabase(request: NextRequest, input: RedeemRewardsInput) {
  const identity = await getLineIdentity(request)
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await redeemRewards(identity.lineUserId, input, readIdempotencyKey(request))

    return NextResponse.json({
      success: true,
      tx_id: result.txId,
      points_used: result.pointsUsed,
      duplicate: result.duplicate,
      coupon: result.coupons[0] ?? null,
      coupons: result.coupons,
    })
  } catch (error) {
    if (error instanceof WriteError) {
      return NextResponse.json(
        {
          success: false,
          error:
            error.code === 'DW001'
              ? 'คะแนนของคุณไม่เพียงพอ'
              : 'ไม่สามารถแลกของรางวัลได้ กรุณาลองใหม่',
          message: error.message,
        },
        { status: error.status },
      )
    }
    console.error('[coupons/redeem] supabase redeem failed:', error)
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถแลกของรางวัลได้ กรุณาลองใหม่' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (isMaintenance()) {
    return NextResponse.json({ success: false, error: MAINTENANCE_MESSAGE }, { status: 503 })
  }

  const parsed = await parseJsonBody(request, redeemRequestSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    return await respondFromSupabase(request, parsed.data)
  } catch (error) {
    console.error('[coupons/redeem] unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'ไม่สามารถแลกของรางวัลได้ กรุณาลองใหม่',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
