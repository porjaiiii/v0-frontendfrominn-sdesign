// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fakeLineIdToken } from '../tests/fake-line-token'

// The server session can outlive the one-hour ID token LIFF mints by up to
// eleven hours. Login only has to go through LINE when GET /api/session says
// there is no usable session — never merely because the token in hand has
// expired.

const sdk = vi.hoisted(() => ({
  token: null as string | null,
  loggedIn: true,
  init: vi.fn(async () => {}),
  login: vi.fn(),
  getProfile: vi.fn(async () => ({ userId: 'U_test_user', displayName: 'Oak' })),
}))

vi.mock('@line/liff', () => ({
  default: {
    init: sdk.init,
    login: sdk.login,
    getProfile: sdk.getProfile,
    isLoggedIn: () => sdk.loggedIn,
    getIDToken: () => sdk.token,
    getDecodedIDToken: () => (sdk.token ? { sub: 'U_test_user' } : null),
    isInClient: () => true,
    getOS: () => 'ios',
    getLanguage: () => 'th',
    getLineVersion: () => '14.0.0',
  },
}))

import { useLiff, type UseLiffReturn } from './use-liff'

const activeSessionResponse = (lineUserId = 'U_test_user') =>
  new Response(JSON.stringify({ lineUserId, expiresAt: null }), { status: 200 })
const noSessionResponse = () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

describe('useLiff keeps the session alive', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>
  /** What GET /api/session answers the next time it is called. */
  let sessionAnswer: () => Response

  /** Mounts the hook and hands back its latest value. */
  async function renderHook(): Promise<() => UseLiffReturn> {
    let value: UseLiffReturn | undefined

    function Harness() {
      value = useLiff('2010479645-testapp')
      return null
    }

    await act(async () => {
      root.render(<Harness />)
    })

    return () => value!
  }

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    sessionStorage.clear()
    sdk.loggedIn = true
    sdk.token = fakeLineIdToken()
    sdk.login.mockClear()
    sdk.init.mockClear()
    sdk.getProfile.mockClear()
    sessionAnswer = () => activeSessionResponse()
    fetchMock = vi.fn(async () => sessionAnswer())
    vi.stubGlobal('fetch', fetchMock)
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.unstubAllGlobals()
  })

  it('leaves a healthy session alone', async () => {
    await renderHook()

    expect(sdk.login).not.toHaveBeenCalled()
  })

  it('re-logs in at startup when the server has no session', async () => {
    sessionAnswer = noSessionResponse

    await renderHook()

    expect(sdk.login).toHaveBeenCalledWith({ redirectUri: window.location.href })
  })

  it('re-logs in when a backgrounded webview is resumed with a dead token and no session', async () => {
    await renderHook()
    sdk.token = fakeLineIdToken(-36_000)
    sessionAnswer = noSessionResponse

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      // The resume handler fires ensureSession() without awaiting it, so the
      // event dispatch above resolves before the mocked fetch chain does.
      // Flushing a macrotask lets every pending microtask — the fetch mock,
      // res.json(), checkSession's parsing — settle first.
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(sdk.login).toHaveBeenCalledWith({ redirectUri: window.location.href })
  })

  it('re-logs in when iOS restores the page from the back/forward cache with no session', async () => {
    // Safari serves a bfcache restore without re-running init, and on iOS the
    // LINE webview is where this session sat for ten hours.
    await renderHook()
    sdk.token = fakeLineIdToken(-36_000)
    sessionAnswer = noSessionResponse

    await act(async () => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(sdk.login).toHaveBeenCalledWith({ redirectUri: window.location.href })
  })

  it('does not redirect twice when the server still has no session', async () => {
    // A wrong LINE_CHANNEL_ID or a broken clock would otherwise bounce the
    // user through LINE forever instead of letting the 401 surface.
    sessionAnswer = noSessionResponse

    await renderHook()
    act(() => root.unmount())
    root = createRoot(container)
    await renderHook()

    expect(sdk.login).toHaveBeenCalledTimes(1)
  })

  it('reports no ID token rather than an expired one', async () => {
    sdk.token = fakeLineIdToken(-36_000)

    const hook = await renderHook()

    expect(hook().getIDToken()).toBeNull()
  })
})
