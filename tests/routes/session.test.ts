import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mocked at the auth boundary, so this runs with no database.
const mocks = vi.hoisted(() => ({ getLineIdentity: vi.fn(), clearSession: vi.fn() }))

vi.mock('@/lib/auth/verify-line-token', () => ({ getLineIdentity: mocks.getLineIdentity }))
vi.mock('@/lib/auth/user-session', () => ({ clearSession: mocks.clearSession }))

import { DELETE, GET } from '@/app/api/session/route'

const req = () => new NextRequest(new URL('/api/session', 'http://localhost:3000'))

beforeEach(() => {
  mocks.getLineIdentity.mockReset()
  mocks.clearSession.mockReset()
})

describe('GET /api/session', () => {
  it('reports whose session this is and when it ends', async () => {
    mocks.getLineIdentity.mockResolvedValue({
      lineUserId: 'U1',
      session: { sid: 'sid-1', expiresAt: 1_800_000_000 },
    })
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ lineUserId: 'U1', expiresAt: 1_800_000_000 })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('reports a null expiry when sessions are switched off', async () => {
    mocks.getLineIdentity.mockResolvedValue({ lineUserId: 'U1' })
    expect(await (await GET(req())).json()).toEqual({ lineUserId: 'U1', expiresAt: null })
  })

  it('answers 401 when there is no identity', async () => {
    mocks.getLineIdentity.mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('DELETE /api/session', () => {
  it('clears the cookie', async () => {
    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(mocks.clearSession).toHaveBeenCalledOnce()
  })
})
