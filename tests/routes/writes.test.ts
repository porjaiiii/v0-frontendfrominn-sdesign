import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { registerUserSchema } from '@/lib/schemas/register'
import { registerUser, updateUser } from '@/lib/supabase/writes'

import { supabaseConfigured } from './fixtures'
import { getServiceClient } from '@/lib/supabase/server'

// Exercises the first Supabase write path directly (not through the route —
// the route requires a real, LINE-signed ID token now that there is no dev
// bypass, and a test process cannot produce one of those).

if (!supabaseConfigured()) {
  throw new Error(
    'Route tests need a local Supabase. Run `pnpm db:start`, then copy the values ' +
      'from `supabase status -o env` into .env.local.',
  )
}

const TEST_USER = 'Utest_phase_register_writes'

async function cleanup(): Promise<void> {
  await getServiceClient().from('users').delete().eq('line_user_id', TEST_USER)
}

beforeEach(cleanup)
afterAll(cleanup)

const baseInput = registerUserSchema.parse({
  pdpaConsent: 'ยอมรับ',
  fullName: 'ทดสอบ เขียนไฟล์',
  nickname: 'เทส',
  phoneNumber: '0812345678',
  address: '99/1 ม.5',
  gender: 'ชาย',
  ageRange: '26-45',
  userType: 'คนในชุมชนคุ้งบางกะเจ้า',
  subdistrict: 'บางกะเจ้า',
  occupation: 'เกษตรกร',
})

describe('registerUser', () => {
  it('inserts a fresh row and stamps a registration date', async () => {
    const profile = await registerUser(TEST_USER, baseInput)

    expect(profile.lineUserId).toBe(TEST_USER)
    expect(profile.fullName).toBe('ทดสอบ เขียนไฟล์')
    expect(profile.name).toBe(profile.fullName)
    expect(profile.subdistrict).toBe('บางกะเจ้า')
    expect(profile.registrationDate).not.toBe('')
  })

  it('normalises empty demographic fields to null instead of violating the FK', async () => {
    const touristInput = registerUserSchema.parse({
      ...baseInput,
      userType: 'นักท่องเที่ยว',
      address: '',
      subdistrict: '',
      occupation: '',
    })

    const profile = await registerUser(TEST_USER, touristInput)
    expect(profile.subdistrict).toBe('')
    expect(profile.occupation).toBe('')
  })

  it('upserts rather than erroring on a repeat submit', async () => {
    await registerUser(TEST_USER, baseInput)
    const second = await registerUser(TEST_USER, {
      ...baseInput,
      fullName: 'ทดสอบ ส่งซ้ำ',
    })

    expect(second.fullName).toBe('ทดสอบ ส่งซ้ำ')

    const { data, error } = await getServiceClient()
      .from('users')
      .select('line_user_id')
      .eq('line_user_id', TEST_USER)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })
})

describe('updateUser', () => {
  it('never overwrites the original registration_date_th', async () => {
    const registered = await registerUser(TEST_USER, baseInput)
    expect(registered.registrationDate).not.toBe('')

    const updated = await updateUser(TEST_USER, {
      ...baseInput,
      fullName: 'ทดสอบ แก้ไขแล้ว',
    })

    expect(updated.fullName).toBe('ทดสอบ แก้ไขแล้ว')
    expect(updated.registrationDate).toBe(registered.registrationDate)
  })
})
