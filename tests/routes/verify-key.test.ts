import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mocked at the auth, session and Supabase boundaries, so this runs with no
// database: what is under test is the FRESH_LOGIN_REQUIRED contract between
// this route and the client (lib/admin-context.tsx), not key activation
// itself (covered, DB-backed, in tests/routes/admin-session.test.ts).

const mocks = vi.hoisted(() => ({
  getLineIdentity: vi.fn(),
  adminSessionSecretConfigured: vi.fn(),
  setAdminCookie: vi.fn(),
  activateAdminKey: vi.fn(),
}))

vi.mock('@/lib/auth/verify-line-token', () => ({ getLineIdentity: mocks.getLineIdentity }))
vi.mock('@/lib/auth/admin-session', () => ({
  adminSessionSecretConfigured: mocks.adminSessionSecretConfigured,
  setAdminCookie: mocks.setAdminCookie,
}))
vi.mock('@/lib/supabase/writes', () => ({
  activateAdminKey: mocks.activateAdminKey,
  WriteError: class WriteError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly code?: string,
    ) {
      super(message)
    }
  },
}))

import { POST } from '@/app/api/admin/verify-key/route'

const req = (body: unknown) =>
  new NextRequest(new URL('/api/admin/verify-key', 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.adminSessionSecretConfigured.mockReturnValue(true)
})

describe('POST /api/admin/verify-key', () => {
  it('answers FRESH_LOGIN_REQUIRED, without touching the key, when the ID token is not fresh', async () => {
    mocks.getLineIdentity.mockResolvedValue(null)

    const res = await POST(req({ adminKey: 'K' }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'FRESH_LOGIN_REQUIRED' })
    expect(mocks.activateAdminKey).not.toHaveBeenCalled()
    expect(mocks.getLineIdentity).toHaveBeenCalledWith(expect.anything(), { requireBearer: true })
  })
})
