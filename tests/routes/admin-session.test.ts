import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAdminToken, verifyAdminToken } from '@/lib/auth/admin-session'
import { getServiceClient } from '@/lib/supabase/server'
import { activateAdminKey, WriteError } from '@/lib/supabase/writes'

import { supabaseConfigured } from './fixtures'

if (!supabaseConfigured()) {
  throw new Error('Route tests need a local Supabase. Run `pnpm db:start`.')
}

// The admin gate used to be `localStorage.admin_session_persistent === 'true'`
// and no route checked anything. These cover the two halves of the replacement:
// a token nobody can forge, and a key nobody can steal.

const USER = 'Utest_admin_session'
const OTHER = 'Utest_admin_session_other'
const KEY = 'TEST-ADMIN-KEY-0001'

const db = getServiceClient()

async function cleanup(): Promise<void> {
  await db.from('admin_keys').delete().eq('key', KEY)
  await db.from('users').delete().in('line_user_id', [USER, OTHER])
}

beforeEach(async () => {
  await cleanup()
  const { error: userError } = await db.from('users').insert(
    [USER, OTHER].map((id) => ({ line_user_id: id, full_name: 'ทดสอบ แอดมิน' })),
  )
  if (userError) throw userError

  const { error } = await db.from('admin_keys').insert({ key: KEY, status: 'unused' })
  if (error) throw error
})
afterAll(cleanup)

describe('admin session tokens', () => {
  it('round-trips a signed token', async () => {
    const token = await createAdminToken(USER)
    const session = await verifyAdminToken(token)

    expect(session?.sub).toBe(USER)
    expect(session!.exp * 1000).toBeGreaterThan(Date.now())
  })

  it('rejects a tampered payload', async () => {
    const token = await createAdminToken(USER)
    const [version, payload, signature] = token.split('.')

    // Re-sign nothing — just swap in a payload claiming to be someone else.
    const forged = Buffer.from(JSON.stringify({ sub: OTHER, exp: 4102444800 })).toString(
      'base64url',
    )
    expect(await verifyAdminToken(`${version}.${forged}.${signature}`)).toBeNull()

    // And a flipped signature.
    expect(await verifyAdminToken(`${version}.${payload}.${'A'.repeat(signature.length)}`)).toBeNull()
  })

  it('rejects an expired token', async () => {
    vi.useFakeTimers()
    try {
      const token = await createAdminToken(USER)
      // 30-day lifetime; jump past it.
      vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000)
      expect(await verifyAdminToken(token)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects junk', async () => {
    for (const token of ['', 'true', 'v1.', 'v2.a.b', 'not.a.token']) {
      expect(await verifyAdminToken(token)).toBeNull()
    }
  })
})

describe('activateAdminKey', () => {
  it('binds an unused key to the caller', async () => {
    expect(await activateAdminKey(KEY, USER)).toBe(true)

    const { data } = await db
      .from('admin_keys')
      .select('status, line_user_id')
      .eq('key', KEY)
      .single()
    expect(data).toMatchObject({ status: 'active', line_user_id: USER })
  })

  it('lets the same person log in again without erroring', async () => {
    await activateAdminKey(KEY, USER)
    expect(await activateAdminKey(KEY, USER)).toBe(false)
  })

  it('refuses a key already bound to someone else', async () => {
    await activateAdminKey(KEY, USER)

    const error = await activateAdminKey(KEY, OTHER).catch((e) => e)
    expect(error).toBeInstanceOf(WriteError)
    expect(error.code).toBe('DW005')
    expect(error.status).toBe(403)
  })

  it('404s on a key that does not exist', async () => {
    const error = await activateAdminKey('NOPE-0000', USER).catch((e) => e)
    expect(error.code).toBe('DW004')
    expect(error.status).toBe(404)
  })

  it('lets exactly one of two people win a race for the same key', async () => {
    const results = await Promise.allSettled([
      activateAdminKey(KEY, USER),
      activateAdminKey(KEY, OTHER),
    ])

    const won = results.filter((r) => r.status === 'fulfilled' && r.value === true)
    expect(won).toHaveLength(1)

    const { data } = await db
      .from('admin_keys')
      .select('line_user_id')
      .eq('key', KEY)
      .single()
    expect([USER, OTHER]).toContain(data!.line_user_id)
  })
})
