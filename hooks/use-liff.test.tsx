// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fakeLineIdToken } from '../tests/fake-line-token'

// The LIFF session lives 12 hours; the ID token it mints lives one. Refreshing
// that token means a redirect through LINE, so it has to happen while the user
// has nothing in progress to lose — at init, and when the webview is resumed.
// Reopening a LIFF app hours later is exactly the reported 401.

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
    isInClient: () => true,
    getOS: () => 'ios',
    getLanguage: () => 'th',
    getLineVersion: () => '14.0.0',
  },
}))

import { useLiff, type UseLiffReturn } from './use-liff'

describe('useLiff keeps the ID token fresh', () => {
  let container: HTMLDivElement
  let root: Root

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
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
  })

  it('leaves a healthy session alone', async () => {
    await renderHook()

    expect(sdk.login).not.toHaveBeenCalled()
  })

  it('re-logs in when the session outlived its ID token', async () => {
    sdk.token = fakeLineIdToken(-36_000)

    await renderHook()

    expect(sdk.login).toHaveBeenCalledWith({ redirectUri: window.location.href })
  })

  it('re-logs in when a backgrounded webview is resumed with a dead token', async () => {
    await renderHook()
    sdk.token = fakeLineIdToken(-36_000)

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(sdk.login).toHaveBeenCalledWith({ redirectUri: window.location.href })
  })

  it('re-logs in when iOS restores the page from the back/forward cache', async () => {
    // Safari serves a bfcache restore without re-running init, and on iOS the
    // LINE webview is where this session sat for ten hours.
    await renderHook()
    sdk.token = fakeLineIdToken(-36_000)

    await act(async () => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    })

    expect(sdk.login).toHaveBeenCalledWith({ redirectUri: window.location.href })
  })

  it('does not redirect twice when login comes back still stale', async () => {
    // A wrong LINE_CHANNEL_ID or a broken clock would otherwise bounce the user
    // through LINE forever instead of letting the 401 surface.
    sdk.token = fakeLineIdToken(-36_000)

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
