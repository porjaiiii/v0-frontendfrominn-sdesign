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
  useLiffContext: () => ({ profile: { userId: 'U_test_user' }, isReady: true }),
}))

import { setLiffSdkReady } from './api-client'
import { PointsProvider, usePoints } from './points-context'

// GET /api/points and POST /api/points both derive the caller from the LINE ID
// token now, so every request from here has to carry one. A plain fetch() sends
// no Authorization header and gets 401 — which this context reports as
// "ไม่สามารถโหลดคะแนนได้", i.e. a signed-in user with a real balance is told
// their points could not be loaded.
//
// The sibling test lib/points-context.test.ts covers the pure helpers; this one
// covers the requests, which is why it needs jsdom and a rendered provider.

describe('points-context sends the LINE ID token', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  const authHeaderOf = (call: unknown[] | undefined) => {
    if (!call) return undefined
    const [, init] = call as [string, RequestInit | undefined]
    return new Headers(init?.headers as HeadersInit).get('Authorization')
  }

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    setLiffSdkReady(true)
    container = document.createElement('div')
    root = createRoot(container)

    fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            account: {
              user_id: 'U_test_user',
              total_points: 120,
              total_weight: 2.5,
              total_co2: 2.58,
              tier: '',
            },
            tx_id: 'tx1',
          }),
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

  /** Renders the provider and hands back the context value. */
  async function renderProvider() {
    let ctx: ReturnType<typeof usePoints> | undefined

    function Harness() {
      ctx = usePoints()
      return null
    }

    await act(async () => {
      root.render(
        <PointsProvider>
          <Harness />
        </PointsProvider>,
      )
    })

    return () => ctx!
  }

  it('authorises the balance load that runs on mount', async () => {
    await renderProvider()

    const call = fetchMock.mock.calls.find(([url]) =>
      String(url).startsWith('/api/points?action=get_account_fast'),
    )
    expect(call).toBeDefined()
    expect(authHeaderOf(call)).toBe('Bearer fake-line-id-token')
  })

  it('authorises spendPoints', async () => {
    const ctx = await renderProvider()

    await act(async () => {
      await ctx().spendPoints(10, { category: 'donate', items: [] })
    })

    const call = fetchMock.mock.calls.find(
      ([url], i) => url === '/api/points' && fetchMock.mock.calls[i][1]?.method === 'POST',
    )
    expect(call).toBeDefined()
    expect(authHeaderOf(call)).toBe('Bearer fake-line-id-token')
  })

  it('shows a real balance rather than an error when the request is authorised', async () => {
    // The symptom this guards against: a 401 falls through to the generic
    // "ไม่สามารถโหลดคะแนนได้" branch, so the user sees an error instead of
    // their points.
    const ctx = await renderProvider()

    expect(ctx().error).toBeNull()
    expect(ctx().points).toBe(120)
  })
})
