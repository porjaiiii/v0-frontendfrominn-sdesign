import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PATCH } from '@/app/api/catalog/rewards/[id]/route'
import { GET } from '@/app/api/catalog/rewards/route'

// The admin rewards page's on/off switch — PATCH /api/catalog/rewards/[id]
// and the admin-only GET ?includeInactive=1 that feeds it.
//
// Mocked at the Supabase and auth boundaries, so this runs with no database:
// what is under test is the gate and the wiring, not the UPDATE itself.

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  setRewardActive: vi.fn(),
  getRewardsCatalog: vi.fn(),
  getAllRewardsForAdmin: vi.fn(),
}))

vi.mock('@/lib/auth/admin-session', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('@/lib/supabase/writes', () => ({
  setRewardActive: mocks.setRewardActive,
  createReward: vi.fn(),
}))
vi.mock('@/lib/supabase/reads', () => ({
  getRewardsCatalog: mocks.getRewardsCatalog,
  getAllRewardsForAdmin: mocks.getAllRewardsForAdmin,
}))

const patch = (id: string, body: unknown) =>
  PATCH(
    new NextRequest(new URL(`/api/catalog/rewards/${id}`, 'http://localhost:3000'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )

const get = (query = '') =>
  GET(new NextRequest(new URL(`/api/catalog/rewards${query}`, 'http://localhost:3000')))

const inactive = {
  id: 3,
  name: 'ถ่านไบโอชาร์',
  description: '1 กิโลกรัม',
  points: 50,
  image: '/images/rewards/biochar.jpg',
  isVariable: false,
  minPoints: null,
  stock: null,
  isActive: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAdmin.mockResolvedValue({ sub: 'Ustaff', exp: 4102444800 })
  mocks.setRewardActive.mockResolvedValue(true)
  mocks.getAllRewardsForAdmin.mockResolvedValue([inactive])
})

describe('PATCH /api/catalog/rewards/[id]', () => {
  it('persists the switch for staff', async () => {
    const res = await patch('3', { isActive: false })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, id: 3, isActive: false })
    expect(mocks.setRewardActive).toHaveBeenCalledWith(3, false)
  })

  it('refuses a caller without a staff session', async () => {
    mocks.requireAdmin.mockResolvedValue(null)

    const res = await patch('3', { isActive: false })

    expect(res.status).toBe(403)
    expect(mocks.setRewardActive).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric id', async () => {
    const res = await patch('abc', { isActive: true })

    expect(res.status).toBe(400)
    expect(mocks.setRewardActive).not.toHaveBeenCalled()
  })

  it('rejects a body without a boolean isActive', async () => {
    const res = await patch('3', { isActive: 'no' })

    expect(res.status).toBe(400)
    expect(mocks.setRewardActive).not.toHaveBeenCalled()
  })

  it('answers 404 for an id that is not in the table', async () => {
    mocks.setRewardActive.mockResolvedValue(false)

    const res = await patch('999', { isActive: true })

    expect(res.status).toBe(404)
  })
})

describe('GET /api/catalog/rewards?includeInactive=1', () => {
  it('returns switched-off rewards with isActive for staff', async () => {
    const res = await get('?includeInactive=1')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.rewards).toEqual([inactive])
    expect(mocks.getRewardsCatalog).not.toHaveBeenCalled()
  })

  it('refuses the full list to a caller without a staff session', async () => {
    mocks.requireAdmin.mockResolvedValue(null)

    const res = await get('?includeInactive=1')

    expect(res.status).toBe(403)
    expect(mocks.getAllRewardsForAdmin).not.toHaveBeenCalled()
  })

  it('leaves the public list unchanged', async () => {
    mocks.getRewardsCatalog.mockResolvedValue([{ ...inactive, isActive: undefined }])

    const res = await get()

    expect(res.status).toBe(200)
    expect(mocks.requireAdmin).not.toHaveBeenCalled()
    expect(mocks.getAllRewardsForAdmin).not.toHaveBeenCalled()
  })
})
