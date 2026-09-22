import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PUT } from '@/app/api/admin/waste/update/route'

// PUT /api/admin/waste/update — staff confirm a pending record in somebody
// else's cart.
//
// Mocked at the Supabase and auth boundaries, so this runs with no database:
// what is under test is who gets credited, not the RPC itself. The case that
// matters most is the staff member who is ALSO signed in to LINE — the owner
// route would credit that token, this one must credit the id in the body.

const mocks = vi.hoisted(() => ({
  getLineIdentity: vi.fn(),
  requireAdmin: vi.fn(),
  confirmWaste: vi.fn(),
}))

vi.mock('@/lib/auth/verify-line-token', () => ({ getLineIdentity: mocks.getLineIdentity }))
vi.mock('@/lib/auth/admin-session', () => ({
  getAdminSession: mocks.requireAdmin,
  requireAdmin: mocks.requireAdmin,
}))
vi.mock('@/lib/supabase/writes', () => ({
  confirmWaste: mocks.confirmWaste,
  WriteError: class WriteError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message)
    }
  },
}))

const OWNER = 'Uowner00000000000000000000000001'
const STAFF = 'Ustaff00000000000000000000000002'
const TIMESTAMP = '2026-09-22T03:00:00.000Z'

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(new URL('/api/admin/waste/update', 'http://localhost:3000'), {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

const record = { user_id: OWNER, timestamp: TIMESTAMP, weight_kg: 2, status: 'done' }

beforeEach(() => {
  vi.clearAllMocks()

  mocks.requireAdmin.mockResolvedValue({ sub: STAFF, exp: 4102444800 })
  mocks.getLineIdentity.mockResolvedValue({ lineUserId: STAFF })
  mocks.confirmWaste.mockResolvedValue({
    record: {
      id: 'rec-1',
      timestamp: TIMESTAMP,
      user_id: OWNER,
      waste_type: 'plastic',
      weight_kg: 2,
      carbon_reduction: 1.5,
      points_earned: 20,
    },
    pointsAwarded: true,
    alreadyConfirmed: false,
    txId: 'tx-1',
  })
})

describe('PUT /api/admin/waste/update', () => {
  it('401s without an admin session, and never writes', async () => {
    mocks.requireAdmin.mockResolvedValue(null)

    const res = await PUT(req(record))

    expect(res.status).toBe(401)
    expect(mocks.confirmWaste).not.toHaveBeenCalled()
  })

  it("credits the owner named in the body, not the staff member's LINE token", async () => {
    const res = await PUT(req(record))

    expect(res.status).toBe(200)
    expect(mocks.confirmWaste).toHaveBeenCalledTimes(1)
    expect(mocks.confirmWaste.mock.calls[0][0]).toBe(OWNER)
    expect(mocks.confirmWaste.mock.calls[0][1]).toMatchObject({
      timestamp: TIMESTAMP,
      weight_kg: 2,
    })

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.user_id).toBe(OWNER)
    expect(body.data.points_awarded).toBe(true)
  })

  it('400s a body with no owner, and never writes', async () => {
    const { user_id: _omitted, ...withoutOwner } = record

    const res = await PUT(req(withoutOwner))

    expect(res.status).toBe(400)
    expect(mocks.confirmWaste).not.toHaveBeenCalled()
  })

  it('passes the Idempotency-Key through, so a double press awards once', async () => {
    await PUT(req(record, { 'idempotency-key': 'press-0001-abcdef' }))

    expect(mocks.confirmWaste.mock.calls[0][2]).toBe('press-0001-abcdef')
  })

  it("answers with the write's own status when the record is not the owner's", async () => {
    const { WriteError } = await import('@/lib/supabase/writes')
    mocks.confirmWaste.mockRejectedValue(new WriteError('Record not found', 404))

    const res = await PUT(req(record))

    expect(res.status).toBe(404)
  })
})
