import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as adminProfileGet } from '@/app/api/admin/profile/[id]/route'
import { GET as adminRecordsGet } from '@/app/api/admin/waste/records/route'
import { GET as couponsGet } from '@/app/api/coupons/route'
import { GET as pointsGet } from '@/app/api/points/route'
import { GET as profileGet } from '@/app/api/profile/[id]/route'
import { GET as recordsGet } from '@/app/api/waste/records/route'

// The authorisation rules for every route keyed by a LINE user id.
//
// Mocked at the Supabase and auth boundaries, so this runs with no database:
// what is under test is who gets an answer, not what the answer contains.
//
// Each of these routes used to serve ANY id with no token. The case that
// matters most here is OTHER — a valid, signed-in user asking for somebody
// else's data — because that is the one a login check alone would still let
// through.

const mocks = vi.hoisted(() => ({
  getLineIdentity: vi.fn(),
  getAdminSession: vi.fn(),
  requireAdmin: vi.fn(),
  getProfile: vi.fn(),
  getWasteRecords: vi.fn(),
  getCouponsByUser: vi.fn(),
  getAccount: vi.fn(),
  getTransactions: vi.fn(),
  getSpendDetails: vi.fn(),
  getCo2Collection: vi.fn(),
}))

vi.mock('@/lib/auth/verify-line-token', () => ({ getLineIdentity: mocks.getLineIdentity }))
vi.mock('@/lib/auth/admin-session', () => ({
  getAdminSession: mocks.getAdminSession,
  requireAdmin: mocks.requireAdmin,
}))
vi.mock('@/lib/supabase/reads', () => ({
  getProfile: mocks.getProfile,
  getWasteRecords: mocks.getWasteRecords,
  getCouponsByUser: mocks.getCouponsByUser,
  getCouponById: vi.fn(),
  getAccount: mocks.getAccount,
  getTransactions: mocks.getTransactions,
  getSpendDetails: mocks.getSpendDetails,
  getCo2Collection: mocks.getCo2Collection,
}))
vi.mock('@/lib/supabase/writes', () => ({
  spendPoints: vi.fn(),
  WriteError: class WriteError extends Error {},
}))

const OWNER = 'Uowner00000000000000000000000001'
const OTHER = 'Uother00000000000000000000000002'

/** `null` means "send no Authorization header at all". */
const req = (url: string, token: string | null = 'a-valid-token') =>
  new NextRequest(new URL(url, 'http://localhost:3000'), {
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
  })

const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()

  // Stands in for the real JWKS verification: a bearer token is OWNER, no
  // bearer token is nobody.
  mocks.getLineIdentity.mockImplementation(async (request: Request) =>
    request.headers.get('authorization') ? { lineUserId: OWNER } : null,
  )

  mocks.requireAdmin.mockResolvedValue(null)
  mocks.getAdminSession.mockResolvedValue(null)
  mocks.getProfile.mockResolvedValue({ lineUserId: OWNER, fullName: 'ทดสอบ ระบบ' })
  mocks.getWasteRecords.mockResolvedValue({ records: [], stats: { total: 0, pending: 0 } })
  mocks.getCouponsByUser.mockResolvedValue([])
  mocks.getAccount.mockResolvedValue({ total_points: 120 })
})

describe('GET /api/profile/[id]', () => {
  it('401s without a token, and never reads the row', async () => {
    const res = await profileGet(req(`/api/profile/${OWNER}`, null), params(OWNER))

    expect(res.status).toBe(401)
    expect(mocks.getProfile).not.toHaveBeenCalled()
  })

  it("403s a signed-in user asking for someone else's profile", async () => {
    const res = await profileGet(req(`/api/profile/${OTHER}`), params(OTHER))

    expect(res.status).toBe(403)
    expect(mocks.getProfile).not.toHaveBeenCalled()
  })

  it('returns your own profile', async () => {
    const res = await profileGet(req(`/api/profile/${OWNER}`), params(OWNER))

    expect(res.status).toBe(200)
    expect(mocks.getProfile).toHaveBeenCalledWith(OWNER)
  })

  it('still 404s an unknown id rather than failing open', async () => {
    mocks.getProfile.mockResolvedValue(null)
    const res = await profileGet(req(`/api/profile/${OWNER}`), params(OWNER))

    expect(res.status).toBe(404)
  })
})

describe('GET /api/waste/records', () => {
  it('401s without a token', async () => {
    const res = await recordsGet(req(`/api/waste/records?user_id=${OWNER}`, null))

    expect(res.status).toBe(401)
    expect(mocks.getWasteRecords).not.toHaveBeenCalled()
  })

  it("403s another user's records", async () => {
    const res = await recordsGet(req(`/api/waste/records?user_id=${OTHER}`))

    expect(res.status).toBe(403)
    expect(mocks.getWasteRecords).not.toHaveBeenCalled()
  })

  it('returns your own records', async () => {
    const res = await recordsGet(req(`/api/waste/records?user_id=${OWNER}`))

    expect(res.status).toBe(200)
    expect(mocks.getWasteRecords).toHaveBeenCalledWith(OWNER)
  })
})

describe('GET /api/coupons', () => {
  it('401s without a token', async () => {
    const res = await couponsGet(req(`/api/coupons?user_id=${OWNER}`, null))

    expect(res.status).toBe(401)
    expect(mocks.getCouponsByUser).not.toHaveBeenCalled()
  })

  it("403s another user's coupons", async () => {
    const res = await couponsGet(req(`/api/coupons?user_id=${OTHER}`))

    expect(res.status).toBe(403)
    expect(mocks.getCouponsByUser).not.toHaveBeenCalled()
  })

  it('returns your own coupons, passing the status filter through', async () => {
    const res = await couponsGet(req(`/api/coupons?user_id=${OWNER}&status=active`))

    expect(res.status).toBe(200)
    expect(mocks.getCouponsByUser).toHaveBeenCalledWith(OWNER, 'active')
  })

  it('no longer serves a coupon by id to an anonymous caller', async () => {
    // The ?coupon_id= branch was removed: a coupon id is the QR payload, so it
    // handed the record to anyone holding one. /api/coupons/[id] serves this
    // under "owner or admin" instead.
    const res = await couponsGet(req('/api/coupons?coupon_id=CPNTEST01-AAAA-BBBB', null))

    expect(res.status).toBe(401)
  })
})

describe('GET /api/points', () => {
  it('401s without a token', async () => {
    const res = await pointsGet(req(`/api/points?action=get_account_fast&user_id=${OWNER}`, null))

    expect(res.status).toBe(401)
    expect(mocks.getAccount).not.toHaveBeenCalled()
  })

  it("403s another user's balance", async () => {
    const res = await pointsGet(req(`/api/points?action=get_account_fast&user_id=${OTHER}`))

    expect(res.status).toBe(403)
    expect(mocks.getAccount).not.toHaveBeenCalled()
  })

  it('returns your own balance', async () => {
    const res = await pointsGet(req(`/api/points?action=get_account_fast&user_id=${OWNER}`))

    expect(res.status).toBe(200)
    expect(mocks.getAccount).toHaveBeenCalledWith(OWNER)
  })

  it.each(['get_transactions', 'get_spend_details', 'get_co2_collection'])(
    "403s %s for another user",
    async (action) => {
      const res = await pointsGet(req(`/api/points?action=${action}&user_id=${OTHER}`))
      expect(res.status).toBe(403)
    },
  )
})

describe('GET /api/admin/profile/[id]', () => {
  it('401s without an admin session, even holding a valid LINE token', async () => {
    const res = await adminProfileGet(req(`/api/admin/profile/${OTHER}`), params(OTHER))

    expect(res.status).toBe(401)
    expect(mocks.getProfile).not.toHaveBeenCalled()
  })

  it("returns any user's profile to an admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ lineUserId: 'Uadmin' })

    const res = await adminProfileGet(req(`/api/admin/profile/${OTHER}`), params(OTHER))

    expect(res.status).toBe(200)
    expect(mocks.getProfile).toHaveBeenCalledWith(OTHER)
  })

  it('404s an unknown user for an admin', async () => {
    mocks.requireAdmin.mockResolvedValue({ lineUserId: 'Uadmin' })
    mocks.getProfile.mockResolvedValue(null)

    const res = await adminProfileGet(req(`/api/admin/profile/${OTHER}`), params(OTHER))

    expect(res.status).toBe(404)
  })
})

describe('GET /api/admin/waste/records', () => {
  it('401s without an admin session, even holding a valid LINE token', async () => {
    const res = await adminRecordsGet(req(`/api/admin/waste/records?user_id=${OTHER}`))

    expect(res.status).toBe(401)
    expect(mocks.getWasteRecords).not.toHaveBeenCalled()
  })

  it("returns another user's records to an admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ lineUserId: 'Uadmin' })

    const res = await adminRecordsGet(req(`/api/admin/waste/records?user_id=${OTHER}`))

    expect(res.status).toBe(200)
    expect(mocks.getWasteRecords).toHaveBeenCalledWith(OTHER)
  })

  it('400s without user_id', async () => {
    mocks.requireAdmin.mockResolvedValue({ lineUserId: 'Uadmin' })

    const res = await adminRecordsGet(req('/api/admin/waste/records'))

    expect(res.status).toBe(400)
    expect(mocks.getWasteRecords).not.toHaveBeenCalled()
  })
})
