import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as rankingGet } from '@/app/api/points/ranking/route'

// The leaderboard is PUBLIC, so what it omits matters as much as what it says.
//
// It used to return the real lineUserId of the top 200 users to anyone. That is
// the identifier every other route is keyed on, which made an open scoreboard a
// bulk id source for the rest of the API. These tests pin the absence.

const mocks = vi.hoisted(() => ({
  getLineIdentity: vi.fn(),
  getLeaderboard: vi.fn(),
}))

vi.mock('@/lib/auth/verify-line-token', () => ({ getLineIdentity: mocks.getLineIdentity }))
vi.mock('@/lib/supabase/reads', () => ({ getLeaderboard: mocks.getLeaderboard }))
// unstable_cache needs a Next request context; the identity of the function is
// all this route relies on.
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

const ME = 'Ume0000000000000000000000000001'
const OTHER = 'Uother00000000000000000000000002'

const row = (lineUserId: string, rank: number, name: string) => ({
  rank,
  lineUserId,
  name,
  carbon: 100 - rank,
  points: 500,
  avatar: '/placeholder.svg',
  location: 'ตำบลบางกะเจ้า',
  isTourist: false,
  isYou: false,
})

const req = (token: string | null) =>
  new NextRequest(new URL('/api/points/ranking', 'http://localhost:3000'), {
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getLineIdentity.mockImplementation(async (request: Request) =>
    request.headers.get('authorization') ? { lineUserId: ME } : null,
  )
  mocks.getLeaderboard.mockResolvedValue({
    ranking: [row(OTHER, 1, 'สมชาย'), row(ME, 2, 'ฉันเอง')],
    byUser: {
      [OTHER]: { location: 'ตำบลบางยอ', isTourist: false },
      [ME]: { location: 'ตำบลบางกะเจ้า', isTourist: false },
    },
  })
})

describe('the public leaderboard never exposes LINE ids', () => {
  it('omits lineUserId from every entry', async () => {
    const body = await (await rankingGet(req('a-valid-token'))).json()

    for (const entry of body.ranking) {
      expect(entry).not.toHaveProperty('lineUserId')
    }
  })

  it('omits them from the raw payload too, not just the parsed entries', async () => {
    // Guards against an id surviving somewhere other than `ranking`.
    const text = JSON.stringify(await (await rankingGet(req('a-valid-token'))).json())

    expect(text).not.toContain(ME)
    expect(text).not.toContain(OTHER)
  })

  it('omits them for an anonymous caller as well', async () => {
    const text = JSON.stringify(await (await rankingGet(req(null))).json())

    expect(text).not.toContain(ME)
    expect(text).not.toContain(OTHER)
  })

  it('still returns the scores everyone comes for', async () => {
    const body = await (await rankingGet(req(null))).json()

    expect(body.ranking).toHaveLength(2)
    expect(body.ranking[0]).toMatchObject({ rank: 1, name: 'สมชาย', carbon: 99 })
  })
})

describe('isYou replaces the id the page used to match on', () => {
  it('marks only the caller’s own row', async () => {
    const body = await (await rankingGet(req('a-valid-token'))).json()

    expect(body.ranking.map((e: { isYou: boolean }) => e.isYou)).toEqual([false, true])
  })

  it('marks nobody when the caller is anonymous', async () => {
    const body = await (await rankingGet(req(null))).json()

    expect(body.ranking.every((e: { isYou: boolean }) => e.isYou === false)).toBe(true)
  })

  it('returns the caller’s own grouping info only when verified', async () => {
    const signedIn = await (await rankingGet(req('a-valid-token'))).json()
    expect(signedIn.caller).toEqual({ location: 'ตำบลบางกะเจ้า', isTourist: false })

    const anonymous = await (await rankingGet(req(null))).json()
    expect(anonymous.caller).toBeNull()
  })

  it('ignores a userId supplied in the query string', async () => {
    // The old route took ?userId= on trust, which told anyone the ตำบล and
    // tourist status of any id they cared to name.
    const url = new URL(`/api/points/ranking?userId=${OTHER}`, 'http://localhost:3000')
    const body = await (await rankingGet(new NextRequest(url))).json()

    expect(body.caller).toBeNull()
    expect(body.ranking.every((e: { isYou: boolean }) => e.isYou === false)).toBe(true)
  })
})
