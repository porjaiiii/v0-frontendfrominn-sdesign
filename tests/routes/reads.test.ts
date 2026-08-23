import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GET as couponsGet } from '@/app/api/coupons/route'
import { GET as pointsGet } from '@/app/api/points/route'
import { GET as profileGet } from '@/app/api/profile/[id]/route'
import { GET as recordsGet } from '@/app/api/waste/records/route'
import type { WasteRecord } from '@/lib/waste-records'

import { cleanup, seed, supabaseConfigured, TEST_USER } from './fixtures'

// Phase 2 read paths, exercised end to end against the local Supabase.
//
// These assert the SHAPE each route returned in the GAS era, because that is
// what "preserve the contract" has to mean to be checkable.

if (!supabaseConfigured()) {
  throw new Error(
    'Route tests need a local Supabase. Run `pnpm db:start`, then copy the values ' +
      'from `supabase status -o env` into .env.local.',
  )
}

const req = (url: string) => new NextRequest(new URL(url, 'http://localhost:3000'))

beforeAll(seed)
afterAll(cleanup)

describe('GET /api/profile/[id]', () => {
  it('returns the profile with the GAS-era field aliases', async () => {
    const res = await profileGet(req('/api/profile/x'), {
      params: Promise.resolve({ id: TEST_USER }),
    })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.lineUserId).toBe(TEST_USER)
    expect(body.fullName).toBe('ทดสอบ ระบบ')
    expect(body.nickname).toBe('เทส')
    expect(body.subdistrict).toBe('บางกะเจ้า')
    // GAS emitted each of these under two names; consumers read both.
    expect(body.name).toBe(body.fullName)
    expect(body.age).toBe(body.ageRange)
    expect(body.type).toBe(body.userType)
  })

  it('404s an unknown user instead of failing open', async () => {
    const res = await profileGet(req('/api/profile/x'), {
      params: Promise.resolve({ id: 'Udoes_not_exist' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/waste/records', () => {
  it('returns typed objects rather than array-of-arrays', async () => {
    const res = await recordsGet(req(`/api/waste/records?user_id=${TEST_USER}`))
    expect(res.status).toBe(200)

    const body = (await res.json()) as { records: WasteRecord[]; stats: unknown }
    expect(body.records).toHaveLength(2)
    expect(Array.isArray(body.records[0])).toBe(false)

    const done = body.records.find((r) => r.status === 'done')!
    expect(done.waste_type).toBe('plastic')
    expect(done.weight_kg).toBe(2.5)
    expect(done.image_urls).toEqual(['https://example.test/a.jpg', 'https://example.test/b.jpg'])
  })

  it('maps an unweighed record to 0, preserving the filter-then-sum total', async () => {
    const res = await recordsGet(req(`/api/waste/records?user_id=${TEST_USER}`))
    const { records } = (await res.json()) as { records: WasteRecord[] }

    const pending = records.find((r) => r.status === 'pending')!
    expect(pending.weight_kg).toBe(0)

    // waste-cart's `weight_kg !== -1` filter now keeps this row, but it
    // contributes 0, so the displayed total is unchanged.
    const total = records
      .filter((r) => r.status === 'pending' && r.weight_kg !== -1)
      .reduce((sum, r) => sum + r.weight_kg, 0)
    expect(total).toBe(0)
  })

  it('scopes stats to the requested user', async () => {
    const res = await recordsGet(req(`/api/waste/records?user_id=${TEST_USER}`))
    const body = await res.json()
    expect(body.stats).toEqual({ total: 2, pending: 1 })
  })

  it('400s without user_id', async () => {
    const res = await recordsGet(req('/api/waste/records'))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/points', () => {
  it('derives the spendable balance from the lots', async () => {
    const res = await pointsGet(req(`/api/points?action=get_account_fast&user_id=${TEST_USER}`))
    const body = await res.json()

    expect(body.success).toBe(true)
    // (100 - 30) + (50 - 0)
    expect(body.account.total_points).toBe(120)
    expect(body.account.total_weight).toBe(2.5)
    expect(body.account.total_co2).toBe(2.58)
    expect(body.account.tier).toBe('นักอนุรักษ์มือใหม่')
  })

  it('reports notFound for a user with no account', async () => {
    const res = await pointsGet(req('/api/points?action=get_account_fast&user_id=Unobody'))
    const body = await res.json()
    expect(body).toEqual({ success: false, notFound: true })
  })

  it('returns transactions newest first, with spends as a positive magnitude', async () => {
    const res = await pointsGet(req(`/api/points?action=get_transactions&user_id=${TEST_USER}`))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.total).toBe(2)
    expect(body.transactions[0].type).toBe('spend')
    expect(body.transactions[0].points).toBe(30)
    expect(body.transactions[1].type).toBe('earn')
  })

  it('returns spend details', async () => {
    const res = await pointsGet(req(`/api/points?action=get_spend_details&user_id=${TEST_USER}`))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.details).toHaveLength(1)
    expect(body.details[0].status).toBe('รอใช้งานคูปอง')
  })

  it('aggregates co2 collection from the done records only', async () => {
    const res = await pointsGet(req(`/api/points?action=get_co2_collection&user_id=${TEST_USER}`))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.collection).toHaveLength(1)
    expect(body.collection[0].waste_type).toBe('plastic')
    expect(body.collection[0].weight).toBe(2.5)
  })
})

describe('GET /api/coupons', () => {
  it('returns every coupon for a user, newest first', async () => {
    const res = await couponsGet(req(`/api/coupons?user_id=${TEST_USER}`))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.total).toBe(2)
    expect(body.coupons[0].coupon_id).toBe('CPNTEST02-CCCC-DDDD')
  })

  it('filters by status in the query', async () => {
    const res = await couponsGet(req(`/api/coupons?user_id=${TEST_USER}&status=active`))
    const body = await res.json()

    expect(body.total).toBe(1)
    expect(body.coupons[0].status).toBe('active')
    expect(body.coupons[0].user_id).toBe(TEST_USER)
  })

  it('looks a single coupon up by id for the scanner', async () => {
    const res = await couponsGet(req('/api/coupons?coupon_id=CPNTEST01-AAAA-BBBB'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.coupon.reward_name).toBe('น้ำยาล้างจาน ซันไลต์')
    expect(body.coupon.points_used).toBe(25)
  })

  it('404s an unknown coupon id', async () => {
    const res = await couponsGet(req('/api/coupons?coupon_id=CPNNOPE'))
    expect(res.status).toBe(404)
  })
})
