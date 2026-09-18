// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// liff.isLoggedIn() stays true for the full 12-hour session, so it cannot tell
// apiFetch whether the ID token it is about to attach is still valid. These
// cover the one thing that can: the token's own exp.

const encode = (obj: object) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function tokenExpiringIn(seconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + seconds
  return `${encode({ alg: 'ES256', typ: 'JWT' })}.${encode({ sub: 'U_test', exp })}.signature`
}

// Hoisted with the vi.mock factory, which runs before the module body.
const session = vi.hoisted(() => ({ token: null as string | null }))

vi.mock('@line/liff', () => ({
  default: {
    isLoggedIn: () => true,
    getIDToken: () => session.token,
  },
}))

import { apiFetch, setLiffSdkReady } from './api-client'

describe('apiFetch and the LINE ID token', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  const sentAuthHeader = () => {
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined]
    return new Headers(init?.headers as HeadersInit).get('Authorization')
  }

  beforeEach(() => {
    setLiffSdkReady(true)
    fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setLiffSdkReady(false)
    session.token = null
  })

  it('sends a token that is still valid', async () => {
    session.token = tokenExpiringIn(600)

    await apiFetch('/api/waste/submit', { method: 'POST' })

    expect(sentAuthHeader()).toBe(`Bearer ${session.token}`)
  })

  it('omits the header rather than sending an expired token', async () => {
    session.token = tokenExpiringIn(-36_000)

    await apiFetch('/api/upload-image/sign', { method: 'POST' })

    expect(sentAuthHeader()).toBeNull()
  })

  it('still sends the request when the token is expired', async () => {
    // The route answers 401 and the caller surfaces it. Dropping the request
    // here instead would turn an expired session into a silent no-op.
    session.token = tokenExpiringIn(-36_000)

    const response = await apiFetch('/api/upload-image/sign', { method: 'POST' })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(response.status).toBe(200)
  })
})
