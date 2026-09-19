// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@line/liff', () => ({
  default: { isLoggedIn: () => false, getIDToken: () => null },
}))

import { checkSession, endSession, needsRelogin } from './session-client'

let fetchMock: ReturnType<typeof vi.fn>

const respond = (status: number, body: unknown = {}) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }))

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('checkSession', () => {
  it('reads an active session', async () => {
    respond(200, { lineUserId: 'U1', expiresAt: 1_800_000_000 })
    expect(await checkSession()).toEqual({
      status: 'active',
      lineUserId: 'U1',
      expiresAt: 1_800_000_000,
    })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/session')
  })

  it('reads 401 as no session', async () => {
    respond(401, { error: 'Unauthorized' })
    expect(await checkSession()).toEqual({ status: 'none' })
  })

  it('reads a server error as unknown', async () => {
    respond(500)
    expect(await checkSession()).toEqual({ status: 'unknown' })
  })

  it('reads a network failure as unknown', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    expect(await checkSession()).toEqual({ status: 'unknown' })
  })
})

describe('needsRelogin', () => {
  const active = (lineUserId: string) =>
    ({ status: 'active', lineUserId, expiresAt: null }) as const

  it('re-logs in when there is no session', () => {
    expect(needsRelogin({ status: 'none' }, 'U1')).toBe(true)
  })

  it('stays when the session belongs to the LIFF user', () => {
    expect(needsRelogin(active('U1'), 'U1')).toBe(false)
  })

  it('re-logs in when the session belongs to another LINE account', () => {
    expect(needsRelogin(active('U2'), 'U1')).toBe(true)
  })

  it('stays when LIFF cannot say who is signed in', () => {
    expect(needsRelogin(active('U2'), null)).toBe(false)
  })

  it('never redirects on an unknown answer', () => {
    expect(needsRelogin({ status: 'unknown' }, 'U1')).toBe(false)
  })
})

describe('endSession', () => {
  it('asks the server to drop the cookie', async () => {
    respond(200, { success: true })
    await endSession()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/session',
      expect.objectContaining({ method: 'DELETE', keepalive: true }),
    )
  })

  it('does not throw when offline', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await expect(endSession()).resolves.toBeUndefined()
  })
})
