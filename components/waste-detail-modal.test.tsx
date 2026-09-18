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
  useApp: () => ({ wasteRates: {} }),
}))

import { setLiffSdkReady } from '@/lib/api-client'

import { WasteDetailModal } from './waste-detail-modal'

// Deleting a cart item the user added by mistake. Only `pending` records can go
// — a confirmed one has already moved points, and the server answers 409.

const pendingRecord = {
  timestamp: '2026-09-18T01:39:50.000Z',
  user_id: 'U_test_user',
  waste_type: 'plastic',
  waste_subtype: 'pet',
  weight_kg: 2.5,
  image_urls: ['waste/U_test_user/photo.jpg'],
  carbon_reduction: 2.5775,
  points_earned: 15,
  status: 'pending',
}

describe('WasteDetailModal delete', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>
  let onDeleted: ReturnType<typeof vi.fn<(record: typeof pendingRecord) => void>>

  /** Every button whose label contains `text`. */
  const buttons = (text: string) =>
    Array.from(container.querySelectorAll('button')).filter((b) => b.textContent?.includes(text))

  const click = async (button: Element) => {
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }

  async function render(record = pendingRecord) {
    await act(async () => {
      root.render(
        <WasteDetailModal
          record={record}
          isOpen
          onClose={() => {}}
          onConfirm={() => {}}
          onDeleted={onDeleted}
        />,
      )
    })
  }

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    setLiffSdkReady(true)
    onDeleted = vi.fn<(record: typeof pendingRecord) => void>()
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }))
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

  it('offers to delete a record still sitting in the cart', async () => {
    await render()

    expect(buttons('ลบรายการ')).toHaveLength(1)
  })

  it('does not offer to delete a record whose points are already awarded', async () => {
    await render({ ...pendingRecord, status: 'done' })

    expect(buttons('ลบรายการ')).toHaveLength(0)
  })

  it('asks for confirmation before deleting anything', async () => {
    await render()

    await click(buttons('ลบรายการ')[0])

    expect(fetchMock).not.toHaveBeenCalled()
    expect(buttons('ยืนยันลบ')).toHaveLength(1)
  })

  it('cancels the record and tells the cart once confirmed', async () => {
    await render()

    await click(buttons('ลบรายการ')[0])
    await click(buttons('ยืนยันลบ')[0])

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/waste/cancel')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ timestamp: pendingRecord.timestamp })
    expect(onDeleted).toHaveBeenCalledWith(pendingRecord)
  })

  it('keeps the record when the server refuses to delete it', async () => {
    // 409: it was confirmed between opening the modal and pressing delete.
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'รายการนี้ได้รับคะแนนแล้ว ไม่สามารถลบได้' }), {
        status: 409,
      }),
    )

    await render()
    await click(buttons('ลบรายการ')[0])
    await click(buttons('ยืนยันลบ')[0])

    expect(onDeleted).not.toHaveBeenCalled()
  })
})
