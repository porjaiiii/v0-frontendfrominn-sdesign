import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { CATALOG_REWARDS } from '@/lib/rewards-catalog'
import { donatePointsSchema, redeemRequestSchema } from '@/lib/schemas/points'
import { getServiceClient } from '@/lib/supabase/server'
import { redeemRewards, spendPoints, useCoupon, WriteError } from '@/lib/supabase/writes'

import { supabaseConfigured } from './fixtures'

// Phase 5 — the three findings the plan calls more severe than the duplicate
// submit: client-set prices, checkout minting nothing, and a guessable coupon id
// behind an unauthenticated use endpoint.

if (!supabaseConfigured()) {
  throw new Error(
    'Route tests need a local Supabase. Run `pnpm db:start`, then copy the values ' +
      'from `supabase status -o env` into .env.local.',
  )
}

const USER = 'Utest_phase5_points'
const db = getServiceClient()

async function cleanup(): Promise<void> {
  await db.from('coupons').delete().eq('line_user_id', USER)
  for (const table of ['point_transactions', 'point_lots', 'waste_records', 'users'] as const) {
    const { error } = await db.from(table).delete().eq('line_user_id', USER)
    if (error) throw new Error(`cleanup(${table}) failed: ${error.message}`)
  }
}

/** Gives the user exactly `points` spendable, across two lots so FIFO is observable. */
async function grant(points: number): Promise<void> {
  const half = Math.floor(points / 2)

  const { error: userError } = await db.from('users').insert({
    line_user_id: USER,
    full_name: 'ทดสอบ คะแนน',
    user_type: 'คนในชุมชนคุ้งบางกะเจ้า',
    pdpa_consent: 'ยอมรับ',
  })
  if (userError) throw userError

  const { error } = await db.from('point_lots').insert([
    {
      line_user_id: USER,
      period: '2026-01',
      earned_points: half,
      consumed_points: 0,
      expires_at: '2028-01-31',
      earned_at: '2026-01-15T03:00:00.000Z',
    },
    {
      line_user_id: USER,
      period: '2026-02',
      earned_points: points - half,
      consumed_points: 0,
      expires_at: '2028-02-29',
      earned_at: '2026-02-15T03:00:00.000Z',
    },
  ])
  if (error) throw error
}

async function spendable(): Promise<number> {
  const { data, error } = await db
    .from('v_user_balances')
    .select('spendable_points')
    .eq('line_user_id', USER)
    .single()
  if (error) throw error
  return data.spendable_points ?? 0
}

beforeEach(cleanup)
afterAll(cleanup)

describe('redeemRewards — pricing', () => {
  it('ignores the price in the request and charges the catalog price', async () => {
    await grant(100)

    // The exact attack: reward 1 costs 25, the request claims 1.
    const input = redeemRequestSchema.parse({
      items: [{ reward_id: 1, quantity: 1, points: 1 }],
    })
    const result = await redeemRewards(USER, input, null)

    expect(result.pointsUsed).toBe(25)
    expect(await spendable()).toBe(75)
    expect(result.coupons[0].points_used).toBe(25)
  })

  it('refuses the 17,000-point reward at a client-supplied price of 1', async () => {
    await grant(100)

    const input = redeemRequestSchema.parse({
      items: [{ reward_id: 7, quantity: 1, points: 1 }],
    })

    const error = await redeemRewards(USER, input, null).catch((e) => e)
    expect(error).toBeInstanceOf(WriteError)
    expect(error.code).toBe('DW001') // priced at 17000, so: not enough points
    expect(await spendable()).toBe(100)
  })

  it('accepts the legacy single-reward body and still prices it server-side', async () => {
    await grant(100)

    const input = redeemRequestSchema.parse({
      user_id: 'ignored',
      reward_id: 1,
      reward_name: 'ของปลอม',
      points_used: 1,
    })
    const result = await redeemRewards(USER, input, null)

    expect(result.pointsUsed).toBe(25)
    expect(result.coupons[0].reward_name).toBe('น้ำยาล้างจาน ซันไลต์')
  })

  it('enforces the cash-back floor that used to be a client-side check', async () => {
    await grant(100)

    const tooLittle = redeemRequestSchema.parse({
      items: [{ reward_id: 99, quantity: 1, points: 5 }],
    })
    const error = await redeemRewards(USER, tooLittle, null).catch((e) => e)
    expect(error.code).toBe('DW003')

    const ok = redeemRequestSchema.parse({
      items: [{ reward_id: 99, quantity: 1, points: 60 }],
    })
    const result = await redeemRewards(USER, ok, null)
    expect(result.pointsUsed).toBe(60)
    expect(result.coupons[0].reward_description).toContain('60 บาท')
  })
})

describe('redeemRewards — spending and minting together', () => {
  it('mints one coupon per unit, so a cart checkout gets something to collect with', async () => {
    await grant(200)

    const input = redeemRequestSchema.parse({
      items: [
        { reward_id: 1, quantity: 2 }, // 25 each
        { reward_id: 3, quantity: 1 }, // 50
      ],
    })
    const result = await redeemRewards(USER, input, null)

    expect(result.pointsUsed).toBe(100)
    expect(result.coupons).toHaveLength(3)
    expect(new Set(result.coupons.map((c) => c.coupon_id)).size).toBe(3)
    expect(await spendable()).toBe(100)
  })

  it('consumes lots oldest-first', async () => {
    await grant(100) // 50 + 50, January then February

    await redeemRewards(USER, redeemRequestSchema.parse({ items: [{ reward_id: 3 }] }), null)

    const { data } = await db
      .from('point_lots')
      .select('period, consumed_points')
      .eq('line_user_id', USER)
      .order('period')

    expect(data).toEqual([
      { period: '2026-01', consumed_points: 50 },
      { period: '2026-02', consumed_points: 0 },
    ])
  })

  it('spends nothing at all when the basket exceeds the balance', async () => {
    await grant(40)

    const input = redeemRequestSchema.parse({ items: [{ reward_id: 1, quantity: 2 }] }) // 50
    const error = await redeemRewards(USER, input, null).catch((e) => e)

    expect(error.code).toBe('DW001')
    // All-or-nothing, matching GAS: a short balance deducts nothing.
    expect(await spendable()).toBe(40)
    const { data } = await db.from('coupons').select('coupon_id').eq('line_user_id', USER)
    expect(data).toHaveLength(0)
  })

  it('replays an Idempotency-Key to the original coupons, charging once', async () => {
    await grant(100)
    const input = redeemRequestSchema.parse({ items: [{ reward_id: 1 }] })

    const first = await redeemRewards(USER, input, 'idem-redeem-1')
    const second = await redeemRewards(USER, input, 'idem-redeem-1')

    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(true)
    expect(second.coupons.map((c) => c.coupon_id)).toEqual(
      first.coupons.map((c) => c.coupon_id),
    )
    expect(await spendable()).toBe(75)
  })

  it('charges once when two redemptions race the same balance', async () => {
    await grant(40) // enough for one 25-point reward, not two

    const input = redeemRequestSchema.parse({ items: [{ reward_id: 1 }] })
    const results = await Promise.allSettled([
      redeemRewards(USER, input, null),
      redeemRewards(USER, input, null),
    ])

    const ok = results.filter((r) => r.status === 'fulfilled')
    expect(ok).toHaveLength(1)
    expect(await spendable()).toBe(15)

    const { data } = await db.from('coupons').select('coupon_id').eq('line_user_id', USER)
    expect(data).toHaveLength(1)
  })

  it('generates coupon ids that are not Math.random()', async () => {
    await grant(200)

    const ids = new Set<string>()
    for (let i = 0; i < 4; i++) {
      const result = await redeemRewards(
        USER,
        redeemRequestSchema.parse({ items: [{ reward_id: 1 }] }),
        null,
      )
      ids.add(result.coupons[0].coupon_id)
      expect(result.coupons[0].coupon_id).toMatch(/^CPN[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}$/)
    }
    expect(ids.size).toBe(4)
  })
})

describe('useCoupon', () => {
  async function mint(): Promise<string> {
    await grant(100)
    const result = await redeemRewards(
      USER,
      redeemRequestSchema.parse({ items: [{ reward_id: 1 }] }),
      null,
    )
    return result.coupons[0].coupon_id
  }

  it('marks the coupon used and flips spend_details in the same transaction', async () => {
    const couponId = await mint()

    const coupon = await useCoupon({ coupon_id: couponId, scanned_by: 'staff-01' })

    expect(coupon.status).toBe('used')
    expect(coupon.scanned_by).toBe('staff-01')

    const { data } = await db
      .from('spend_details')
      .select('status')
      .eq('line_user_id', USER)
    expect(data).toEqual([{ status: 'ใช้คูปองแล้ว' }])
  })

  it('rejects a second scan of the same QR', async () => {
    const couponId = await mint()
    await useCoupon({ coupon_id: couponId })

    const error = await useCoupon({ coupon_id: couponId }).catch((e) => e)
    expect(error).toBeInstanceOf(WriteError)
    expect(error.status).toBe(409)
  })

  it('lets exactly one of two simultaneous scans succeed', async () => {
    const couponId = await mint()

    const results = await Promise.allSettled([
      useCoupon({ coupon_id: couponId, scanned_by: 'staff-01' }),
      useCoupon({ coupon_id: couponId, scanned_by: 'staff-02' }),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
  })

  it('404s on an unknown coupon', async () => {
    const error = await useCoupon({ coupon_id: 'CPNNOPE0000-0000-0000' }).catch((e) => e)
    expect(error.status).toBe(404)
  })
})

describe('spendPoints — donations', () => {
  it('takes the amount from the request, because the user chooses it', async () => {
    await grant(100)

    const input = donatePointsSchema.parse({
      points: 30,
      items: [{ name: 'กองทุนต้นไม้', quantity: 1, points: 30 }],
    })
    const result = await spendPoints(USER, input, 'donate', null)

    expect(result.pointsSpent).toBe(30)
    expect(result.remainingBalance).toBe(70)

    const { data } = await db
      .from('spend_details')
      .select('category, status')
      .eq('line_user_id', USER)
    expect(data).toEqual([{ category: 'donate', status: 'บริจาคสำเร็จ' }])
  })

  it('mints no coupon', async () => {
    await grant(100)
    await spendPoints(USER, donatePointsSchema.parse({ points: 30 }), 'donate', null)

    const { data } = await db.from('coupons').select('coupon_id').eq('line_user_id', USER)
    expect(data).toHaveLength(0)
  })

  it('refuses to overdraw', async () => {
    await grant(10)
    const error = await spendPoints(
      USER,
      donatePointsSchema.parse({ points: 30 }),
      'donate',
      null,
    ).catch((e) => e)

    expect(error.code).toBe('DW001')
    expect(await spendable()).toBe(10)
  })
})

describe('catalog parity', () => {
  it('lib/rewards-catalog agrees with the SEEDED rows of app.rewards, so the flag cannot change a price', async () => {
    // Not exact-length parity any more (Phase 7): POST /api/catalog/rewards lets
    // an admin add rows at runtime, and this file is a static fallback — it
    // only has to stay honest about the rows it claims to know, not about every
    // row that exists.
    const { data, error } = await db
      .from('rewards')
      .select('id, name, points, is_variable, min_points')
      .in('id', CATALOG_REWARDS.map((reward) => reward.id))
      .order('id')
    expect(error).toBeNull()

    expect(data).toHaveLength(CATALOG_REWARDS.length)

    for (const row of data!) {
      const local = CATALOG_REWARDS.find((reward) => reward.id === row.id)
      expect(local, `reward ${row.id} missing from lib/rewards-catalog`).toBeDefined()
      expect(local!.name).toBe(row.name)
      expect(local!.points).toBe(row.points)
      expect(local!.isVariable).toBe(row.is_variable)
      expect(local!.minPoints).toBe(row.min_points)
    }
  })
})
