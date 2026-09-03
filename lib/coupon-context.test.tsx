// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@line/liff', () => ({
  default: {
    isLoggedIn: () => true,
    getIDToken: () => 'fake-line-id-token',
  },
}))

vi.mock('./liff-context', () => ({
  useLiffContext: () => ({ profile: { userId: 'U_test_user' } }),
}))

import { setLiffSdkReady } from './api-client'
import { CouponProvider, useCoupons } from './coupon-context'

// redeemRewards must go through apiFetch so the server can identify the
// caller — a request with no Authorization header always gets 401 from
// getLineIdentity(), regardless of who is actually logged in.
describe('redeemRewards', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    setLiffSdkReady(true)
    container = document.createElement('div')
    root = createRoot(container)

    fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ success: true, tx_id: 'tx1', points_used: 10, coupons: [] }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.unstubAllGlobals()
    setLiffSdkReady(false)
  })

  it('sends the LINE ID token as a Bearer header', async () => {
    let redeem: ReturnType<typeof useCoupons>['redeemRewards'] | undefined

    function Harness() {
      const ctx = useCoupons()
      redeem = ctx.redeemRewards
      return null
    }

    await act(async () => {
      root.render(
        <CouponProvider>
          <Harness />
        </CouponProvider>,
      )
    })

    await act(async () => {
      await redeem!({ items: [{ reward_id: 1, quantity: 1 }] })
    })

    const redeemCall = fetchMock.mock.calls.find(([url]) => url === '/api/coupons/redeem')
    expect(redeemCall).toBeDefined()

    const [, init] = redeemCall!
    const headers = new Headers(init?.headers as HeadersInit)
    expect(headers.get('Authorization')).toBe('Bearer fake-line-id-token')
  })
})
