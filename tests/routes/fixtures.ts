import { getServiceClient } from '@/lib/supabase/server'

export const TEST_USER = 'Utest_phase2_reads'

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/** Removes the fixture user; every child table cascades from it. */
export async function cleanup(): Promise<void> {
  await getServiceClient().from('users').delete().eq('line_user_id', TEST_USER)
}

/**
 * A user with a known, hand-checkable state:
 *   - 2 waste records (one done + weighed, one pending + unweighed)
 *   - 2 point lots: 100 earned / 30 consumed, and 50 earned  → spendable 120
 *   - 1 earn transaction, 1 spend transaction with a spend detail
 *   - 2 coupons, one active and one used
 */
export async function seed(): Promise<void> {
  const db = getServiceClient()
  await cleanup()

  const { error: userError } = await db.from('users').insert({
    line_user_id: TEST_USER,
    display_user_id: 'DW0000000001',
    full_name: 'ทดสอบ ระบบ',
    nickname: 'เทส',
    phone_number: '0812345678',
    gender: 'ชาย',
    age_range: '26-45',
    user_type: 'นักท่องเที่ยว',
    subdistrict: 'บางกะเจ้า',
    occupation: 'เกษตรกร',
    pdpa_consent: 'ยอมรับ',
    registration_date_th: '1/1/2569',
  })
  if (userError) throw userError

  const { error: wasteError } = await db.from('waste_records').insert([
    {
      line_user_id: TEST_USER,
      waste_type_id: 'plastic',
      waste_subtype_id: 'pet',
      weight_kg: 2.5,
      image_urls: ['https://example.test/a.jpg', 'https://example.test/b.jpg'],
      carbon_reduction_kg: 2.5775,
      points_earned: 15,
      status: 'done',
      recorded_at: '2026-06-01T03:00:00.000Z',
    },
    {
      line_user_id: TEST_USER,
      waste_type_id: 'paper',
      waste_subtype_id: 'a4',
      // NULL weight — the legacy -1 "not yet weighed" sentinel.
      weight_kg: null,
      // Must be explicit: a multi-row insert unions the keys across rows and
      // sends NULL for any this row omits, which defeats the column default.
      image_urls: [],
      carbon_reduction_kg: 0,
      points_earned: 0,
      status: 'pending',
      recorded_at: '2026-06-02T03:00:00.000Z',
    },
  ])
  if (wasteError) throw wasteError

  const { error: accountError } = await db.from('points_accounts').insert({
    line_user_id: TEST_USER,
    lifetime_earned: 150,
    lifetime_spent: 30,
    total_weight_kg: 2.5,
    total_co2_kg: 2.5775,
    tier: 'นักอนุรักษ์มือใหม่',
  })
  if (accountError) throw accountError

  const { error: lotError } = await db.from('point_lots').insert([
    {
      line_user_id: TEST_USER,
      period: '2026-05',
      earned_points: 100,
      consumed_points: 30,
      expires_at: '2028-05-31',
      earned_at: '2026-05-10T03:00:00.000Z',
    },
    {
      line_user_id: TEST_USER,
      period: '2026-06',
      earned_points: 50,
      consumed_points: 0,
      expires_at: '2028-06-30',
      earned_at: '2026-06-01T03:00:00.000Z',
    },
  ])
  if (lotError) throw lotError

  const { error: txError } = await db.from('point_transactions').insert([
    {
      tx_id: 'tx_test_earn_0001',
      line_user_id: TEST_USER,
      kind: 'earn',
      points_delta: 100,
      co2_kg: 2.5775,
      weight_kg: 2.5,
      occurred_at: '2026-05-10T03:00:00.000Z',
    },
    {
      tx_id: 'tx_test_spend_0001',
      line_user_id: TEST_USER,
      kind: 'spend',
      points_delta: -30,
      co2_kg: 0,
      weight_kg: 0,
      occurred_at: '2026-05-20T03:00:00.000Z',
    },
  ])
  if (txError) throw txError

  const { error: spendError } = await db.from('spend_details').insert({
    tx_id: 'tx_test_spend_0001',
    line_user_id: TEST_USER,
    category: 'reward',
    item_name: 'น้ำยาล้างจาน ซันไลต์',
    quantity: 1,
    points: 30,
    status: 'รอใช้งานคูปอง',
    occurred_at: '2026-05-20T03:00:00.000Z',
  })
  if (spendError) throw spendError

  const { error: couponError } = await db.from('coupons').insert([
    {
      coupon_id: 'CPNTEST01-AAAA-BBBB',
      line_user_id: TEST_USER,
      reward_id: 1,
      reward_name: 'น้ำยาล้างจาน ซันไลต์',
      reward_description: '',
      reward_image: '/images/rewards/sunlight-dish-soap.jpg',
      points_used: 25,
      tx_id: 'tx_test_spend_0001',
      status: 'active',
      redeemed_at: '2026-05-20T03:00:00.000Z',
    },
    {
      coupon_id: 'CPNTEST02-CCCC-DDDD',
      line_user_id: TEST_USER,
      reward_id: 3,
      reward_name: 'ถ่านไบโอชาร์',
      reward_description: '1 กิโลกรัม',
      reward_image: '/images/rewards/biochar.jpg',
      points_used: 50,
      status: 'used',
      used_at: '2026-05-25T03:00:00.000Z',
      scanned_by: 'staff',
      redeemed_at: '2026-05-21T03:00:00.000Z',
    },
  ])
  if (couponError) throw couponError
}
