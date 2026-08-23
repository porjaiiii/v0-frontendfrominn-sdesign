import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { submitWasteSchema, updateWasteSchema } from '@/lib/schemas/waste'
import { getServiceClient } from '@/lib/supabase/server'
import { confirmWaste, submitWaste, WriteError } from '@/lib/supabase/writes'

import { supabaseConfigured } from './fixtures'

// Phase 4 write paths, exercised against real Postgres.
//
// The two tests that justify the whole migration are the concurrency ones: they
// need two connections racing the same row, so they cannot be unit tests and a
// mocked client would pass them trivially.

if (!supabaseConfigured()) {
  throw new Error(
    'Route tests need a local Supabase. Run `pnpm db:start`, then copy the values ' +
      'from `supabase status -o env` into .env.local.',
  )
}

const USER = 'Utest_phase4_waste'
const OTHER_USER = 'Utest_phase4_waste_other'

const db = getServiceClient()

/**
 * Ordered, because point_lots.source_waste_id is `on delete restrict`: a single
 * `delete from users` races its own cascades and can hit that restrict. Errors
 * are thrown rather than ignored — a cleanup that silently fails shows up as a
 * confusing users_pkey violation in the *next* test.
 */
async function cleanup(): Promise<void> {
  for (const table of ['point_transactions', 'point_lots', 'waste_records', 'users'] as const) {
    const { error } = await db.from(table).delete().in('line_user_id', [USER, OTHER_USER])
    if (error) throw new Error(`cleanup(${table}) failed: ${error.message}`)
  }
}

async function createUsers(): Promise<void> {
  const { error } = await db.from('users').insert(
    [USER, OTHER_USER].map((id) => ({
      line_user_id: id,
      full_name: 'ทดสอบ ขยะ',
      user_type: 'คนในชุมชนคุ้งบางกะเจ้า',
      pdpa_consent: 'ยอมรับ',
    })),
  )
  if (error) throw error
}

async function spendable(lineUserId = USER): Promise<number> {
  const { data, error } = await db
    .from('v_user_balances')
    .select('spendable_points')
    .eq('line_user_id', lineUserId)
    .single()
  if (error) throw error
  return data.spendable_points ?? 0
}

/** plastic is seeded at 1.0310 kg CO2e/kg and 6 points/kg (0003_seed_catalog.sql). */
const plastic = (weight: number | null, key?: string) => ({
  input: submitWasteSchema.parse({
    waste_type: 'plastic',
    waste_subtype: 'pet',
    weight_kg: weight,
    image_urls: [],
  }),
  key: key ?? null,
})

beforeEach(async () => {
  await cleanup()
  await createUsers()
})
afterAll(cleanup)

describe('submitWaste', () => {
  it('lands in the cart as pending and prices from app.waste_types', async () => {
    const { input } = plastic(2.5)
    const { record, duplicate } = await submitWaste(USER, input, null)

    expect(duplicate).toBe(false)
    // GAS hardcoded 'pending' over the client's 'done'; so does the RPC.
    expect(record.status).toBe('pending')
    expect(record.points_earned).toBe(15) // round(2.5 * 6)
    expect(record.carbon_reduction).toBeCloseTo(2.5775, 4) // 2.5 * 1.0310
  })

  it('accepts the legacy -1 "not yet weighed" sentinel as no weight', async () => {
    const { record } = await submitWaste(USER, plastic(-1).input, null)

    expect(record.weight_kg).toBe(0)
    expect(record.points_earned).toBe(0)
    expect(record.status).toBe('pending')
  })

  it('replays an Idempotency-Key to the original record, never a second row', async () => {
    const { input } = plastic(2.5)

    const first = await submitWaste(USER, input, 'idem-submit-0001')
    const second = await submitWaste(USER, input, 'idem-submit-0001')

    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(true)
    expect(second.record.id).toBe(first.record.id)

    const { data } = await db.from('waste_records').select('id').eq('line_user_id', USER)
    expect(data).toHaveLength(1)
  })

  it('creates exactly one row when the same key arrives twice at once', async () => {
    const { input } = plastic(2.5)

    const results = await Promise.all([
      submitWaste(USER, input, 'idem-submit-race'),
      submitWaste(USER, input, 'idem-submit-race'),
    ])

    expect(new Set(results.map((r) => r.record.id)).size).toBe(1)

    const { data } = await db.from('waste_records').select('id').eq('line_user_id', USER)
    expect(data).toHaveLength(1)
  })

  it('refuses a key that already belongs to another account', async () => {
    await submitWaste(OTHER_USER, plastic(1).input, 'idem-shared-key')

    await expect(submitWaste(USER, plastic(1).input, 'idem-shared-key')).rejects.toMatchObject({
      status: 409,
    })
  })

  it('rejects an unknown waste type as a 400, not a 500', async () => {
    const input = submitWasteSchema.parse({
      waste_type: 'unobtainium',
      waste_subtype: 'pet',
      weight_kg: 1,
    })

    const error = await submitWaste(USER, input, null).catch((e) => e)
    expect(error).toBeInstanceOf(WriteError)
    expect(error.status).toBe(400)
  })
})

describe('confirmWaste', () => {
  async function pending(weight: number | null = null) {
    const { record } = await submitWaste(USER, plastic(weight).input, null)
    return record
  }

  const confirmInput = (timestamp: string, weight: number | null) =>
    updateWasteSchema.parse({ timestamp, weight_kg: weight, status: 'done' })

  it('marks the record done and awards the points in one transaction', async () => {
    const record = await pending()
    expect(await spendable()).toBe(0)

    const result = await confirmWaste(USER, confirmInput(record.timestamp, 4), null)

    expect(result.pointsAwarded).toBe(true)
    expect(result.alreadyConfirmed).toBe(false)
    expect(result.txId).toMatch(/^tx_[0-9a-f]{32}$/)
    expect(result.record.status).toBe('done')
    expect(result.record.points_earned).toBe(24) // round(4 * 6)
    expect(await spendable()).toBe(24)
  })

  it('writes the lot, the transaction, the ledger entry and the aggregates together', async () => {
    const record = await pending()
    const result = await confirmWaste(USER, confirmInput(record.timestamp, 4), null)

    const { data: lots } = await db
      .from('point_lots')
      .select('earned_points, consumed_points, status, expires_at, period, source_waste_id')
      .eq('line_user_id', USER)
    expect(lots).toHaveLength(1)
    expect(lots![0].earned_points).toBe(24)
    expect(lots![0].source_waste_id).toBe(record.id)
    // Last day of the month, two years on — the GAS off-by-one is fixed here.
    expect(lots![0].expires_at).toMatch(/^\d{4}-\d{2}-(28|29|30|31)$/)

    const { data: entries } = await db
      .from('point_ledger_entries')
      .select('points_delta')
      .eq('tx_id', result.txId!)
    expect(entries).toEqual([{ points_delta: 24 }])

    const { data: account } = await db
      .from('points_accounts')
      .select('lifetime_earned, total_weight_kg, total_co2_kg, tier')
      .eq('line_user_id', USER)
      .single()
    expect(account!.lifetime_earned).toBe(24)
    expect(Number(account!.total_weight_kg)).toBe(4)
    expect(account!.tier).toBe('นักอนุรักษ์มือใหม่')
  })

  it('awards nothing on a replay and returns the same body', async () => {
    const record = await pending()
    const first = await confirmWaste(USER, confirmInput(record.timestamp, 4), 'idem-confirm-1')
    const second = await confirmWaste(USER, confirmInput(record.timestamp, 4), 'idem-confirm-1')

    expect(first.pointsAwarded).toBe(true)
    expect(second.pointsAwarded).toBe(false)
    expect(second.alreadyConfirmed).toBe(true)
    expect(second.record.points_earned).toBe(first.record.points_earned)

    // The bug that prompted the migration: this used to be 48.
    expect(await spendable()).toBe(24)
  })

  it('awards once when two confirms race the same record', async () => {
    const record = await pending()

    const results = await Promise.all([
      confirmWaste(USER, confirmInput(record.timestamp, 4), null),
      confirmWaste(USER, confirmInput(record.timestamp, 4), null),
    ])

    expect(results.filter((r) => r.pointsAwarded)).toHaveLength(1)
    expect(await spendable()).toBe(24)

    const { data: lots } = await db.from('point_lots').select('id').eq('line_user_id', USER)
    expect(lots).toHaveLength(1)

    const { data: txs } = await db
      .from('point_transactions')
      .select('tx_id')
      .eq('line_user_id', USER)
    expect(txs).toHaveLength(1)
  })

  it('refuses to confirm a record that was never weighed', async () => {
    const record = await pending()

    const error = await confirmWaste(USER, confirmInput(record.timestamp, null), null).catch(
      (e) => e,
    )
    expect(error).toBeInstanceOf(WriteError)
    expect(error.status).toBe(400)

    // GAS accepted this and wrote weight -1 with a NEGATIVE carbon reduction.
    const { data } = await db
      .from('waste_records')
      .select('status')
      .eq('id', record.id)
      .single()
    expect(data!.status).toBe('pending')
  })

  it('marks a sub-rounding record done without creating an empty lot', async () => {
    const record = await pending()
    // 0.05 kg * 6 points/kg rounds to 0 — earnPoints rejected points <= 0.
    const result = await confirmWaste(USER, confirmInput(record.timestamp, 0.05), null)

    expect(result.record.status).toBe('done')
    expect(result.pointsAwarded).toBe(false)
    expect(result.txId).toBeNull()

    const { data: lots } = await db.from('point_lots').select('id').eq('line_user_id', USER)
    expect(lots).toHaveLength(0)
  })

  it('404s on a record that does not exist', async () => {
    const error = await confirmWaste(
      USER,
      confirmInput('2020-01-01T00:00:00.000Z', 1),
      null,
    ).catch((e) => e)

    expect(error).toBeInstanceOf(WriteError)
    expect(error.status).toBe(404)
  })

  it('cannot confirm another account’s record', async () => {
    const record = await pending()

    const error = await confirmWaste(
      OTHER_USER,
      confirmInput(record.timestamp, 4),
      null,
    ).catch((e) => e)

    expect(error.status).toBe(404)
    expect(await spendable(OTHER_USER)).toBe(0)
  })

  it('recomputes the tier from total weight, not from points', async () => {
    const record = await pending()
    await confirmWaste(USER, confirmInput(record.timestamp, 160), null)

    const { data } = await db
      .from('points_accounts')
      .select('tier, lifetime_earned')
      .eq('line_user_id', USER)
      .single()

    // 160 kg clears the 150 kg threshold; 960 points would clear every points
    // threshold, so this asserts the tier is weight-based.
    expect(data!.tier).toBe('นักอนุรักษ์ระดับกลาง')
    expect(data!.lifetime_earned).toBe(960)
  })
})
