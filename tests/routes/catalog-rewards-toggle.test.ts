import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as GET_ONE, PATCH } from '@/app/api/catalog/rewards/[id]/route'
import { GET } from '@/app/api/catalog/rewards/route'

// The admin rewards page's on/off switch and the reward editor —
// PATCH /api/catalog/rewards/[id], the admin-only GET of one reward that
// fills the editor, and the admin-only GET ?includeInactive=1 list.
//
// Mocked at the Supabase and auth boundaries, so this runs with no database:
// what is under test is the gate and the wiring, not the UPDATE itself.

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  updateReward: vi.fn(),
  getRewardsCatalog: vi.fn(),
  getAllRewardsForAdmin: vi.fn(),
  getRewardForAdmin: vi.fn(),
}))

vi.mock('@/lib/auth/admin-session', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('@/lib/supabase/writes', () => ({
  updateReward: mocks.updateReward,
  createReward: vi.fn(),
}))
vi.mock('@/lib/supabase/reads', () => ({
  getRewardsCatalog: mocks.getRewardsCatalog,
  getAllRewardsForAdmin: mocks.getAllRewardsForAdmin,
  getRewardForAdmin: mocks.getRewardForAdmin,
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

const getOne = (id: string) =>
  GET_ONE(new NextRequest(new URL(`/api/catalog/rewards/${id}`, 'http://localhost:3000')), {
    params: Promise.resolve({ id }),
  })

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

const cashBack = {
  id: 100,
  name: 'แลกแต้มเป็นเงินคืน',
  description: 'คูปองแลกเงินสด',
  points: 1,
  image: '/images/rewards/THB-cash.jpg',
  isVariable: true,
  minPoints: 1,
  stock: null,
  isActive: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAdmin.mockResolvedValue({ sub: 'Ustaff', exp: 4102444800 })
  mocks.updateReward.mockResolvedValue(true)
  mocks.getAllRewardsForAdmin.mockResolvedValue([inactive])
  mocks.getRewardForAdmin.mockResolvedValue(inactive)
})

describe('PATCH /api/catalog/rewards/[id]', () => {
  it('persists the switch for staff', async () => {
    const res = await patch('3', { isActive: false })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, id: 3, isActive: false })
    expect(mocks.updateReward).toHaveBeenCalledWith(3, { isActive: false })
  })

  it('refuses a caller without a staff session', async () => {
    mocks.requireAdmin.mockResolvedValue(null)

    const res = await patch('3', { isActive: false })

    expect(res.status).toBe(403)
    expect(mocks.updateReward).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric id', async () => {
    const res = await patch('abc', { isActive: true })

    expect(res.status).toBe(400)
    expect(mocks.updateReward).not.toHaveBeenCalled()
  })

  it('rejects a body without a boolean isActive', async () => {
    const res = await patch('3', { isActive: 'no' })

    expect(res.status).toBe(400)
    expect(mocks.updateReward).not.toHaveBeenCalled()
  })

  it('answers 404 for an id that is not in the table', async () => {
    mocks.updateReward.mockResolvedValue(false)

    const res = await patch('999', { isActive: true })

    expect(res.status).toBe(404)
  })

  it('saves every field the editor sends', async () => {
    const res = await patch('3', {
      name: '  ถ่านไบโอชาร์ถุงใหญ่ ',
      description: '2 กิโลกรัม',
      points: 80,
      imagePath: 'rewards/abc.jpg',
      stock: 5,
    })

    expect(res.status).toBe(200)
    expect(mocks.updateReward).toHaveBeenCalledWith(3, {
      name: 'ถ่านไบโอชาร์ถุงใหญ่',
      description: '2 กิโลกรัม',
      points: 80,
      imagePath: 'rewards/abc.jpg',
      stock: 5,
    })
  })

  it('leaves fields the editor omits untouched', async () => {
    await patch('3', { name: 'ชื่อใหม่' })

    // No defaults filled in — a missing description/imagePath must not blank
    // the stored one the way createRewardSchema's `default('')` would.
    expect(mocks.updateReward).toHaveBeenCalledWith(3, { name: 'ชื่อใหม่' })
  })

  it('clears stock to unlimited on an explicit null', async () => {
    await patch('3', { stock: null })

    expect(mocks.updateReward).toHaveBeenCalledWith(3, { stock: null })
  })

  it('rejects a body with nothing to change', async () => {
    const res = await patch('3', {})

    expect(res.status).toBe(400)
    expect(mocks.updateReward).not.toHaveBeenCalled()
  })

  it('rejects a blank name', async () => {
    const res = await patch('3', { name: '   ' })

    expect(res.status).toBe(400)
    expect(mocks.updateReward).not.toHaveBeenCalled()
  })

  it('rejects zero points', async () => {
    const res = await patch('3', { points: 0 })

    expect(res.status).toBe(400)
    expect(mocks.updateReward).not.toHaveBeenCalled()
  })

  it('refuses to reprice the variable cash-back reward', async () => {
    mocks.getRewardForAdmin.mockResolvedValue(cashBack)

    const res = await patch('100', { points: 20 })

    // Its `points` is the redemption floor, not a price.
    expect(res.status).toBe(400)
    expect(mocks.updateReward).not.toHaveBeenCalled()
  })

  it('still lets the cash-back reward be renamed', async () => {
    mocks.getRewardForAdmin.mockResolvedValue(cashBack)

    const res = await patch('100', { name: 'เงินคืน' })

    expect(res.status).toBe(200)
    expect(mocks.updateReward).toHaveBeenCalledWith(100, { name: 'เงินคืน' })
  })

  it('answers 404 when repricing an id that is not in the table', async () => {
    mocks.getRewardForAdmin.mockResolvedValue(null)

    const res = await patch('999', { points: 20 })

    expect(res.status).toBe(404)
    expect(mocks.updateReward).not.toHaveBeenCalled()
  })
})

describe('GET /api/catalog/rewards/[id]', () => {
  it('returns one reward, switched off or not, for staff', async () => {
    const res = await getOne('3')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, reward: inactive })
    expect(mocks.getRewardForAdmin).toHaveBeenCalledWith(3)
  })

  it('refuses a caller without a staff session', async () => {
    mocks.requireAdmin.mockResolvedValue(null)

    const res = await getOne('3')

    expect(res.status).toBe(403)
    expect(mocks.getRewardForAdmin).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric id', async () => {
    const res = await getOne('abc')

    expect(res.status).toBe(400)
    expect(mocks.getRewardForAdmin).not.toHaveBeenCalled()
  })

  it('answers 404 for an id that is not in the table', async () => {
    mocks.getRewardForAdmin.mockResolvedValue(null)

    const res = await getOne('999')

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
