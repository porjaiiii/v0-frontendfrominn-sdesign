// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fakeLineIdToken } from '../tests/fake-line-token'

const sdk = vi.hoisted(() => ({ login: vi.fn() }))

vi.mock('@line/liff', () => ({
  default: {
    login: sdk.login,
    isLoggedIn: () => true,
    getIDToken: () => fakeLineIdToken(),
  },
}))

import { setLiffSdkReady } from './api-client'
import { AdminProvider, useAdmin, type AdminLoginResult } from './admin-context'

// adminLogin's FRESH_LOGIN_REQUIRED branch is the client half of the fix for
// staff getting stuck on "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" forever: a live
// session cookie is not enough to activate an admin key, and with sessions the
// app no longer refreshes an expired ID token on its own. This pins that
// adminLogin sends the caller through LINE rather than just reporting failure.
describe('adminLogin', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    setLiffSdkReady(true)
    sdk.login.mockClear()

    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/admin/session')) {
        return new Response(JSON.stringify({ isAdmin: false }), { status: 200 })
      }
      if (url.includes('/api/admin/verify-key')) {
        return new Response(JSON.stringify({ error: 'FRESH_LOGIN_REQUIRED' }), { status: 401 })
      }
      throw new Error(`Unexpected fetch in this test: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.unstubAllGlobals()
    setLiffSdkReady(false)
  })

  it('sends staff through LINE and reports FRESH_LOGIN_REQUIRED', async () => {
    let adminLogin: ((key: string, userId: string) => Promise<AdminLoginResult>) | undefined

    function Probe() {
      const ctx = useAdmin()
      adminLogin = ctx.adminLogin
      return null
    }

    await act(async () => {
      root.render(
        <AdminProvider>
          <Probe />
        </AdminProvider>,
      )
      // Lets AdminProvider's own mount fetch (GET /api/admin/session) settle
      // inside this act(), rather than leaking an unwrapped state update into
      // the assertions below.
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    let result: AdminLoginResult | undefined
    await act(async () => {
      result = await adminLogin!('K', 'U1')
    })

    expect(result).toEqual({ success: false, reason: 'FRESH_LOGIN_REQUIRED' })
    expect(sdk.login).toHaveBeenCalledWith(expect.objectContaining({ redirectUri: expect.any(String) }))
  })
})
