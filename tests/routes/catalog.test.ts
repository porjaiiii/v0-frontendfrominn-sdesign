import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { getServiceClient } from '@/lib/supabase/server'
import { getDonationCampaigns, getRewardsCatalog, getWasteTypes } from '@/lib/supabase/reads'
import {
  createDonationCampaign,
  createReward,
  redeemRewards,
  WriteError,
} from '@/lib/supabase/writes'
import { createRewardSchema, createDonationCampaignSchema } from '@/lib/schemas/catalog'
import { redeemRequestSchema } from '@/lib/schemas/points'

import { supabaseConfigured } from './fixtures'

// Phase 7 — the catalog admin forms had nowhere to POST
// ("// TODO: POST to GAS / API route"), and the rate/reward/donation data they
// manage was duplicated as static arrays in five different files. This covers
// the write side (createReward/createDonationCampaign), the read side
// (getWasteTypes/getRewardsCatalog/getDonationCampaigns), and the one new
// invariant redeem_rewards now enforces: stock.

if (!supabaseConfigured()) {
  throw new Error('Route tests need a local Supabase. Run `pnpm db:start`.')
}

const db = getServiceClient()
const USER = 'Utest_phase7_catalog'

let createdRewardIds: number[] = []
let createdDonationIds: number[] = []

async function cleanup(): Promise<void> {
  await db.from('coupons').delete().eq('line_user_id', USER)
  for (const table of ['point_transactions', 'point_lots', 'users'] as const) {
    await db.from(table).delete().eq('line_user_id', USER)
  }
  if (createdRewardIds.length > 0) {
    await db.from('rewards').delete().in('id', createdRewardIds)
    createdRewardIds = []
  }
  if (createdDonationIds.length > 0) {
    await db.from('donation_campaigns').delete().in('id', createdDonationIds)
    createdDonationIds = []
  }
}

beforeEach(cleanup)
afterAll(cleanup)

describe('getWasteTypes', () => {
  it('returns only active types, matching lib/rates.ts', async () => {
    const types = await getWasteTypes()
    const ids = types.map((t) => t.id)

    expect(ids).toEqual(expect.arrayContaining(['plastic', 'paper', 'glass', 'aluminum']))
    // is_active = false in 0003_seed_catalog.sql — must not appear here even
    // though lib/rates.ts still carries a fallback value for it.
    expect(ids).not.toContain('oil')

    const plastic = types.find((t) => t.id === 'plastic')!
    expect(plastic.carbonFactor).toBeCloseTo(1.031, 4)
    expect(plastic.pointsPerKg).toBe(6)
  })
})

describe('getRewardsCatalog / createReward', () => {
  it('lists the seeded catalog with images resolved', async () => {
    const rewards = await getRewardsCatalog()
    const sunlight = rewards.find((r) => r.id === 1)!

    expect(sunlight.points).toBe(25)
    expect(sunlight.stock).toBeNull()
    // Bundled asset path, not a bucket URL — catalogImageUrl passes local
    // paths through untouched.
    expect(sunlight.image).toBe('/images/rewards/sunlight-dish-soap.jpg')
  })

  it('creates a reward that immediately shows up in the live catalog', async () => {
    const input = createRewardSchema.parse({
      name: 'ทดสอบของรางวัลใหม่',
      description: 'สร้างจากเทส',
      points: 42,
      stock: 3,
    })
    const created = await createReward(input)
    createdRewardIds.push(created.id)

    expect(created.name).toBe('ทดสอบของรางวัลใหม่')
    expect(created.points).toBe(42)
    expect(created.stock).toBe(3)

    // This is the assertion that matters — a reward created here must be
    // readable back, or the admin form would be writing into a void again.
    const rewards = await getRewardsCatalog()
    expect(rewards.some((r) => r.id === created.id)).toBe(true)
  })

  it('assigns ids above the current maximum, never colliding with a seeded row', async () => {
    const input = createRewardSchema.parse({ name: 'ของรางวัลที่สอง', points: 10 })
    const created = await createReward(input)
    createdRewardIds.push(created.id)

    expect(created.id).toBeGreaterThan(99) // 99 is the highest seeded id (cash-back)
  })
})

describe('getDonationCampaigns / createDonationCampaign', () => {
  it('lists the four seeded campaigns preserved from app/donate/page.tsx', async () => {
    const donations = await getDonationCampaigns()
    expect(donations.length).toBeGreaterThanOrEqual(4)
    expect(donations.map((d) => d.name)).toContain('ทำบุญค่าบูรณะวัดจากแดง')
  })

  it('creates a campaign that shows up in the live list', async () => {
    const input = createDonationCampaignSchema.parse({
      name: 'ทดสอบแคมเปญใหม่',
      description: 'สร้างจากเทส',
    })
    const created = await createDonationCampaign(input)
    createdDonationIds.push(created.id)

    expect(created.currentAmount).toBe(0)
    expect(created.closesAt).toBeNull()

    const donations = await getDonationCampaigns()
    expect(donations.some((d) => d.id === created.id)).toBe(true)
  })

  it('rejects a malformed closesAt rather than storing a bad date silently', () => {
    const result = createDonationCampaignSchema.safeParse({
      name: 'x',
      closesAt: '31/12/2569', // not YYYY-MM-DD
    })
    expect(result.success).toBe(false)
  })
})

describe('redeem_rewards — stock', () => {
  async function grant(points: number): Promise<void> {
    const { error: userError } = await db.from('users').insert({
      line_user_id: USER,
      full_name: 'ทดสอบ สต๊อก',
      user_type: 'คนในชุมชนคุ้งบางกะเจ้า',
      pdpa_consent: 'ยอมรับ',
    })
    if (userError) throw userError

    const { error } = await db.from('point_lots').insert({
      line_user_id: USER,
      period: '2026-08',
      earned_points: points,
      consumed_points: 0,
      expires_at: '2028-08-31',
      earned_at: new Date().toISOString(),
    })
    if (error) throw error
  }

  async function limitedReward(stock: number): Promise<number> {
    const created = await createReward(
      createRewardSchema.parse({ name: 'ของมีจำกัด', points: 10, stock }),
    )
    createdRewardIds.push(created.id)
    return created.id
  }

  it('lets a redemption through when stock covers it, and decrements it', async () => {
    await grant(100)
    const rewardId = await limitedReward(5)

    await redeemRewards(
      USER,
      redeemRequestSchema.parse({ items: [{ reward_id: rewardId, quantity: 2 }] }),
      null,
    )

    const { data } = await db.from('rewards').select('stock').eq('id', rewardId).single()
    expect(data!.stock).toBe(3)
  })

  it('refuses to oversell, and charges nothing when it does', async () => {
    await grant(100)
    const rewardId = await limitedReward(1)

    const input = redeemRequestSchema.parse({ items: [{ reward_id: rewardId, quantity: 2 }] })
    const error = await redeemRewards(USER, input, null).catch((e) => e)

    expect(error).toBeInstanceOf(WriteError)
    expect(error.code).toBe('DW003')

    const { data: reward } = await db.from('rewards').select('stock').eq('id', rewardId).single()
    expect(reward!.stock).toBe(1) // untouched

    const { data: balance } = await db
      .from('v_user_balances')
      .select('spendable_points')
      .eq('line_user_id', USER)
      .single()
    expect(balance!.spendable_points).toBe(100) // untouched
  })

  it('lets exactly one of two simultaneous redemptions win the last unit', async () => {
    await grant(100)
    const rewardId = await limitedReward(1)

    const input = redeemRequestSchema.parse({ items: [{ reward_id: rewardId, quantity: 1 }] })
    const results = await Promise.allSettled([
      redeemRewards(USER, input, null),
      redeemRewards(USER, input, null),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)

    const { data } = await db.from('rewards').select('stock').eq('id', rewardId).single()
    expect(data!.stock).toBe(0)
  })

  it('never touches stock for an unlimited (stock = null) reward', async () => {
    await grant(100)
    // Reward id 1 is seeded with stock = null.
    await redeemRewards(
      USER,
      redeemRequestSchema.parse({ items: [{ reward_id: 1, quantity: 3 }] }),
      null,
    )

    const { data } = await db.from('rewards').select('stock').eq('id', 1).single()
    expect(data!.stock).toBeNull()
  })
})
