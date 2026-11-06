// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// admin-session.ts reads cookies through next/headers, which only works inside
// a Next request. These tests never touch the cookie store.
vi.mock('next/headers', () => ({ cookies: vi.fn() }))

import { createAdminToken, verifyAdminToken } from './admin-session'

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
