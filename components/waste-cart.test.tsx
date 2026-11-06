// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fakeLineIdToken } from '../tests/fake-line-token'

const session = vi.hoisted(() => ({ token: '' }))
session.token = fakeLineIdToken()

vi.mock('@line/liff', () => ({
  default: {
    isLoggedIn: () => true,
    getIDToken: () => session.token,
  },
}))

vi.mock('@/lib/app-context', () => ({
  useApp: () => ({ wasteRates: null, wasteRatesLoading: false }),
}))

import { setLiffSdkReady } from '@/lib/api-client'

import { WasteCart } from './waste-cart'

// Staff at the scanner pressing ยืนยันข้อมูล on somebody else's cart. The cart
// used to return early in admin mode, so the button did nothing at all.

const OWNER = 'U_cart_owner'

const pendingRecord = {
  timestamp: '2026-09-22T03:00:00.000Z',
  user_id: OWNER,
  waste_type: 'plastic',
  waste_subtype: 'pet',
  weight_kg: 2,
  image_urls: ['waste/U_cart_owner/photo.jpg'],
  carbon_reduction: 2.062,
  points_earned: 12,
  status: 'pending',
}

describe('WasteCart ยืนยันข้อมูล', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  const confirmButton = () =>
    Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('ยืนยันข้อมูล'),
    )!

  async function render(admin: boolean) {
    await act(async () => {
      root.render(<WasteCart userId={OWNER} admin={admin} />)
    })
  }

  const writes = () =>
    (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
      ([, init]) => init?.method === 'PUT',
    )

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    setLiffSdkReady(true)
    fetchMock = vi.fn(async (_path: string, init?: RequestInit) =>
      init?.method === 'PUT'
        ? new Response(JSON.stringify({ success: true, data: {} }), { status: 200 })
        : new Response(JSON.stringify({ records: [pendingRecord] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('alert', vi.fn())
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    setLiffSdkReady(false)
  })

  it("lets staff confirm, crediting the record's owner through the admin route", async () => {
    await render(true)

    await act(async () => {
      confirmButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(writes()).toHaveLength(1)
    const [path, init] = writes()[0]
    expect(path).toBe('/api/admin/waste/update')
    expect(JSON.parse(init!.body as string)).toMatchObject({
      user_id: OWNER,
      timestamp: pendingRecord.timestamp,
    })
    // Confirmed records leave the pending cart.
    expect(container.textContent).toContain('ยังไม่มีรายการขยะที่รอยืนยัน')
  })

  it('never confirms through the retired owner route, even outside admin mode', async () => {
    // /api/waste/update answers 403: users cannot confirm their own records.
    await render(false)

    await act(async () => {
      confirmButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(writes()).toHaveLength(1)
    expect(writes()[0][0]).toBe('/api/admin/waste/update')
  })
})
