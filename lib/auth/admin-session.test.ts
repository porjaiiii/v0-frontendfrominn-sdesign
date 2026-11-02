// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { cookies } from 'next/headers'

// admin-session.ts reads cookies through next/headers, which only works inside
// a Next request, and the key's status through the database. Both are stubbed.
vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const reads = vi.hoisted(() => ({ hasActiveAdminKey: vi.fn() }))
vi.mock('@/lib/supabase/reads', () => reads)

import { ADMIN_COOKIE, createAdminToken, getAdminSession, verifyAdminToken } from './admin-session'

const SECRET = 'admin-test-secret-at-least-32-characters-long'

beforeEach(() => {
  vi.stubEnv('ADMIN_SESSION_SECRET', SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('admin session tokens', () => {
  it('verifies a token it issued', async () => {
    const session = await verifyAdminToken(await createAdminToken('U_admin'))
    expect(session?.sub).toBe('U_admin')
  })

  it('lasts 30 days', async () => {
    const before = Math.floor(Date.now() / 1000)
    const session = await verifyAdminToken(await createAdminToken('U_admin'))
    expect(session!.exp - before).toBeGreaterThanOrEqual(30 * 24 * 60 * 60)
    expect(session!.exp - before).toBeLessThanOrEqual(30 * 24 * 60 * 60 + 1)
  })

  it('rejects an expired token', async () => {
    const token = await createAdminToken('U_admin')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000)
    expect(await verifyAdminToken(token)).toBeNull()
  })

  it('rejects a token signed under another secret', async () => {
    const token = await createAdminToken('U_admin')
    vi.stubEnv('ADMIN_SESSION_SECRET', 'a-completely-different-secret-of-32-chars')
    expect(await verifyAdminToken(token)).toBeNull()
  })

  it('treats no token as no session, even with no secret configured', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', '')
    expect(await verifyAdminToken(undefined)).toBeNull()
  })
})

// A valid signature proves the cookie was issued, not that its holder is still
// staff. Revoking the key has to end the session without waiting out 30 days.
describe('getAdminSession', () => {
  async function withCookie(token: string | undefined) {
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => (name === ADMIN_COOKIE && token ? { value: token } : undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>)
  }

  beforeEach(() => {
    reads.hasActiveAdminKey.mockReset()
  })

  it('returns the session while the key is still active', async () => {
    await withCookie(await createAdminToken('U_admin'))
    reads.hasActiveAdminKey.mockResolvedValue(true)

    expect((await getAdminSession())?.sub).toBe('U_admin')
    expect(reads.hasActiveAdminKey).toHaveBeenCalledWith('U_admin')
  })

  it('denies a validly signed cookie once the key is revoked', async () => {
    await withCookie(await createAdminToken('U_admin'))
    reads.hasActiveAdminKey.mockResolvedValue(false)

    expect(await getAdminSession()).toBeNull()
  })

  it('denies when the key lookup fails', async () => {
    await withCookie(await createAdminToken('U_admin'))
    reads.hasActiveAdminKey.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await getAdminSession()).toBeNull()
  })

  it('does not query the database without a valid cookie', async () => {
    await withCookie('v1.forged.signature')

    expect(await getAdminSession()).toBeNull()
    expect(reads.hasActiveAdminKey).not.toHaveBeenCalled()
  })
})
