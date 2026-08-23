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
 * still accepted and mapped onto the new shape, so the client bundle and the
 * BACKEND_COUPONS flag can be deployed in either order. Its `points_used` is
 * read as a variable-reward amount and otherwise discarded.
 *
 * Response 200: { success: true, tx_id, points_used, coupon, coupons[] }
 *   `coupon` is the first coupon, preserved for existing callers that read a
 *   single object. One coupon is minted per unit.
 */

import { NextRequest, NextResponse } from 'next/server'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { backendFor, isMaintenance, MAINTENANCE_MESSAGE } from '@/lib/backend-flags'
import { COUPON_SCRIPT_URL, type CouponRecord } from '@/lib/coupon-config'
import { POINTS_SCRIPT_URL } from '@/lib/points-config'
import { priceRedemption, PricingError } from '@/lib/rewards-catalog'
import { parseJsonBody, readIdempotencyKey } from '@/lib/schemas/common'
import { redeemRequestSchema, type RedeemRewardsInput } from '@/lib/schemas/points'
import { redeemRewards, WriteError } from '@/lib/supabase/writes'

// ---------------------------------------------------------------------------
// Supabase — one transaction: price, spend, mint
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

// ---------------------------------------------------------------------------
// GAS — spend, then mint. Two web apps, no transaction.
// ---------------------------------------------------------------------------

function generateCouponId(): string {
  // Still Math.random() on this path, because the coupon id has to be generated
  // the same way the sheet has always seen it. app.new_coupon_id() is CSPRNG.
  const hex = () => Math.random().toString(16).substring(2, 10).toUpperCase()
  return `CPN${hex()}-${hex().substring(0, 4)}-${hex().substring(0, 4)}`
}

/**
 * Prices from lib/rewards-catalog rather than from the request, so the client
 * cannot set a price on this backend either — that fix is not conditional on
 * the flag. Everything else about this path is unchanged: the spend and the
 * mint remain two independent calls that can half-fail.
 */
async function respondFromGas(
  request: NextRequest,
  input: RedeemRewardsInput,
  lineUserId: string,
) {
  const { lines, total } = priceRedemption(input.items)

  const spendRes = await fetch(POINTS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'spend_points',
      user_id: lineUserId,
      points: total,
      category: 'reward',
      items: lines.map((line) => ({
        name: line.reward.name,
        quantity: line.quantity,
        points: line.unitPoints * line.quantity,
      })),
    }),
  })

  const spendResult = await spendRes.json().catch(() => null)
  if (!spendRes.ok || !spendResult?.success) {
    return NextResponse.json(
      {
        success: false,
        error: spendResult?.message ?? 'ไม่สามารถใช้คะแนนได้',
        current_balance: spendResult?.current_balance,
      },
      { status: spendResult?.message?.includes('Not enough') ? 402 : 400 },
    )
  }

  const coupons: CouponRecord[] = []

  for (const line of lines) {
    for (let i = 0; i < line.quantity; i++) {
      const coupon: CouponRecord & { redeem_type?: string } = {
        coupon_id: generateCouponId(),
        user_id: lineUserId,
        reward_id: line.reward.id,
        reward_name: line.reward.name,
        reward_description: line.description,
        reward_image: line.reward.image,
        points_used: line.unitPoints,
        tx_id: spendResult.tx_id ?? '',
        redeem_type: input.redeem_type,
        status: 'active',
        redeemed_at: new Date().toISOString(),
        used_at: '',
        expires_at: '',
        scanned_by: '',
      }

      const response = await fetch(COUPON_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redeem', coupon }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[coupons/redeem] GAS error:', errorText.substring(0, 300))
        // Points are already gone and some coupons may already exist. Nothing
        // here can undo that — which is the structural reason this path is
        // being replaced rather than repaired.
        return NextResponse.json(
          {
            success: false,
            error: 'แลกคะแนนสำเร็จ แต่ไม่สามารถสร้างคูปองได้ กรุณาติดต่อเจ้าหน้าที่',
            tx_id: spendResult.tx_id,
            coupons,
          },
          { status: 500 },
        )
      }

      coupons.push(coupon)
    }
  }

  return NextResponse.json({
    success: true,
    tx_id: spendResult.tx_id,
    points_used: total,
    duplicate: false,
    coupon: coupons[0] ?? null,
    coupons,
  })
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
    if (backendFor('coupons') === 'supabase') {
      return await respondFromSupabase(request, parsed.data)
    }

    // The GAS path has never authenticated; it reads the id from the body,
    // exactly as it does in production today. Deliberately unchanged — it dies
    // with the flag rather than being half-migrated.
    const body = (await request.clone().json().catch(() => ({}))) as { user_id?: string }
    const identity = await getLineIdentity(request)
    const lineUserId = identity?.lineUserId ?? body.user_id

    if (!lineUserId) {
      return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
    }

    return await respondFromGas(request, parsed.data, lineUserId)
  } catch (error) {
    if (error instanceof PricingError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      )
    }
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
