import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PATCH, POST } from '@/app/api/register/route'

// The wiring between registration and the LINE OA greeting: POST greets, PATCH
// must not. Nothing covered this before, so `{ greet: true }` could have been
// dropped — or the await removed — without a single test turning red.
//
// Fully mocked on purpose: no database, and above all no real POST to GAS #3,
// which would push an actual LINE message to an actual user.

const mocks = vi.hoisted(() => ({
  getLineIdentity: vi.fn(),
  registerUser: vi.fn(),
  updateUser: vi.fn(),
  notifyRegistrationComplete: vi.fn(),
}))

vi.mock('@/lib/auth/verify-line-token', () => ({ getLineIdentity: mocks.getLineIdentity }))
vi.mock('@/lib/supabase/writes', () => ({
  registerUser: mocks.registerUser,
  updateUser: mocks.updateUser,
}))
vi.mock('@/lib/notify-registration', () => ({
  notifyRegistrationComplete: mocks.notifyRegistrationComplete,
}))

const TEST_USER = 'Utest_greeting_wiring'

const BODY = {
  pdpaConsent: 'ยอมรับ',
  fullName: 'ทดสอบ ทักทาย',
  nickname: 'เทส',
  phoneNumber: '0812345678',
  address: '99/1 ม.5',
  gender: 'ชาย',
  ageRange: '26-45',
  userType: 'คนในชุมชนคุ้งบางกะเจ้า',
  subdistrict: 'บางกะเจ้า',
  occupation: 'เกษตรกร',
}

/**
 * What the database hands back. Deliberately disagrees with BODY: `userId` and
 * `registrationDate` are assigned by the write and cannot come from the
 * request, and fullName differs so "built from the stored row" is checkable.
 */
const STORED = {
  ...BODY,
  lineUserId: TEST_USER,
  userId: 'DW0000000001',
  fullName: 'ทดสอบ ตามที่บันทึก',
  registrationDate: '1/1/2569',
}

const req = (body: unknown) =>
  new NextRequest(new URL('/api/register', 'http://localhost:3000'), {
    method: 'POST',
    headers: { Authorization: 'Bearer stub', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getLineIdentity.mockResolvedValue({ lineUserId: TEST_USER })
  mocks.registerUser.mockResolvedValue(STORED)
  mocks.updateUser.mockResolvedValue(STORED)
  mocks.notifyRegistrationComplete.mockResolvedValue(true)
})

describe('POST /api/register', () => {
  it('triggers the LINE greeting exactly once', async () => {
    const res = await POST(req(BODY))

    expect(res.status).toBe(200)
    expect(mocks.notifyRegistrationComplete).toHaveBeenCalledTimes(1)
  })

  it('greets with the stored row, not the request body', async () => {
    await POST(req({ ...BODY, fullName: 'ชื่อจากคำขอ' }))

    const payload = mocks.notifyRegistrationComplete.mock.calls[0][0]
    // A greeting that disagrees with what was saved is worse than no greeting.
    expect(payload.fullName).toBe(STORED.fullName)
    expect(payload.userId).toBe(STORED.userId)
    expect(payload.registrationDate).toBe(STORED.registrationDate)
  })

  it('greets the verified LINE identity, never a body-supplied id', async () => {
    await POST(req({ ...BODY, lineUserId: 'Uattacker_supplied' }))

    expect(mocks.registerUser.mock.calls[0][0]).toBe(TEST_USER)
    expect(mocks.notifyRegistrationComplete.mock.calls[0][0].lineUserId).toBe(TEST_USER)
  })

  it('awaits the greeting before responding', async () => {
    // On Vercel a dangling promise is killed the moment the response returns,
    // so "fire and forget" here means "mostly never delivered".
    let delivered = false
    mocks.notifyRegistrationComplete.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      delivered = true
      return true
    })

    await POST(req(BODY))
    expect(delivered).toBe(true)
  })

  it('still returns 200 when the greeting could not be sent', async () => {
    mocks.notifyRegistrationComplete.mockResolvedValue(false)

    const res = await POST(req(BODY))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('does not greet when the write fails', async () => {
    mocks.registerUser.mockRejectedValue(new Error('duplicate key'))

    const res = await POST(req(BODY))
    expect(res.status).toBe(500)
    expect(mocks.notifyRegistrationComplete).not.toHaveBeenCalled()
  })

  it('does not greet an unauthenticated caller', async () => {
    mocks.getLineIdentity.mockResolvedValue(null)

    const res = await POST(req(BODY))
    expect(res.status).toBe(401)
    expect(mocks.notifyRegistrationComplete).not.toHaveBeenCalled()
  })

  it('does not greet when the body fails validation', async () => {
    // fullName is the only field registerUserSchema requires to be non-empty.
    const res = await POST(req({ ...BODY, fullName: '   ' }))

    expect(res.status).toBe(400)
    expect(mocks.notifyRegistrationComplete).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/register', () => {
  it('never re-sends the greeting when a profile is edited', async () => {
    const res = await PATCH(req(BODY))

    expect(res.status).toBe(200)
    expect(mocks.updateUser).toHaveBeenCalledTimes(1)
    expect(mocks.notifyRegistrationComplete).not.toHaveBeenCalled()
  })
})
