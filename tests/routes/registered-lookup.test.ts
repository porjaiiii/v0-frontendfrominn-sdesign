import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/api/registered/[id]/route'

// The endpoint GAS #3 calls to decide which rich menu a user gets.
// Mocked at the Supabase boundary: this is about the auth gate and the
// fail-closed behaviour, not about the query.

const mocks = vi.hoisted(() => ({ isRegistered: vi.fn() }))
vi.mock('@/lib/supabase/reads', () => ({ isRegistered: mocks.isRegistered }))

const SECRET = 'dwa-secret-2024'

const req = (secret?: string) =>
  new NextRequest(new URL('/api/registered/Uabc', 'http://localhost:3000'), {
    headers: secret === undefined ? {} : { 'x-registration-secret': secret },
  })

const params = { params: Promise.resolve({ id: 'Uabc' }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('GAS_REGISTRATION_SECRET', SECRET)
  mocks.isRegistered.mockResolvedValue(true)
})

afterEach(() => vi.unstubAllEnvs())

describe('auth gate', () => {
  it('answers a caller holding the shared secret', async () => {
    const res = await GET(req(SECRET), params)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ registered: true })
  })

  it('401s a caller with no secret, without touching the database', async () => {
    const res = await GET(req(), params)

    expect(res.status).toBe(401)
    expect(mocks.isRegistered).not.toHaveBeenCalled()
  })

  it('401s a wrong secret', async () => {
    const res = await GET(req('wrong-secret-here'), params)

    expect(res.status).toBe(401)
    expect(mocks.isRegistered).not.toHaveBeenCalled()
  })

  it('401s a secret that is a prefix of the real one', async () => {
    // Length mismatch must be rejected, not thrown on by timingSafeEqual.
    const res = await GET(req(SECRET.slice(0, -1)), params)

    expect(res.status).toBe(401)
  })

  it('denies everything when the secret is not configured, rather than failing open', async () => {
    vi.stubEnv('GAS_REGISTRATION_SECRET', undefined)

    const res = await GET(req(SECRET), params)
    expect(res.status).toBe(401)
    expect(mocks.isRegistered).not.toHaveBeenCalled()
  })
})

describe('lookup', () => {
  it('reports an unregistered user as false, not as an error', async () => {
    mocks.isRegistered.mockResolvedValue(false)

    const res = await GET(req(SECRET), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ registered: false })
  })

  it('500s on a database failure so the caller cannot read it as "not registered"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.isRegistered.mockRejectedValue(new Error('connection refused'))

    const res = await GET(req(SECRET), params)
    expect(res.status).toBe(500)
    expect(await res.json()).not.toHaveProperty('registered')
  })

  it('never caches the answer', async () => {
    const res = await GET(req(SECRET), params)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('leaks no profile data — the body is the boolean and nothing else', async () => {
    const res = await GET(req(SECRET), params)
    expect(Object.keys(await res.json())).toEqual(['registered'])
  })
})
