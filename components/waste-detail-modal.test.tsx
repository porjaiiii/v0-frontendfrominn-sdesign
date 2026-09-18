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

const app = vi.hoisted(() => ({
  wasteRates: null as Record<string, { carbonFactor: number; pointsPerKg: number }> | null,
}))

vi.mock('@/lib/app-context', () => ({
  useApp: () => ({ wasteRates: app.wasteRates, wasteRatesLoading: false }),
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

  async function render(record = pendingRecord, admin = false) {
    await act(async () => {
      root.render(
        <WasteDetailModal
          record={record}
          isOpen
          onClose={() => {}}
          onConfirm={() => {}}
          onDeleted={onDeleted}
          admin={admin}
        />,
      )
    })
  }

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    setLiffSdkReady(true)
    onDeleted = vi.fn<(record: typeof pendingRecord) => void>()
    app.wasteRates = { plastic: { carbonFactor: 1.031, pointsPerKg: 6 } }
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

  it('lets staff delete from somebody else\'s cart through the admin route', async () => {
    await render(pendingRecord, true)

    await click(buttons('ลบรายการ')[0])
    await click(buttons('ยืนยันลบ')[0])

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/admin/waste/cancel')
    expect(JSON.parse(init.body as string)).toEqual({
      user_id: pendingRecord.user_id,
      timestamp: pendingRecord.timestamp,
    })
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

  describe('when the live rates have not loaded', () => {
    // There is no static rate table to fall back on any more. Values the server
    // already computed are still shown — those are real — but anything this
    // modal would have to work out for itself becomes "—" rather than a number
    // the server may not agree with.

    /** Types a weight, which is what triggers a local recalculation. */
    const typeWeight = async (value: string) => {
      const input = container.querySelector('input[inputMode="decimal"]') as HTMLInputElement
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )!.set!
        setter.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }

    it('shows — instead of an estimate it cannot stand behind', async () => {
      app.wasteRates = null
      await render()

      await typeWeight('3')

      expect(container.textContent).toContain('— แต้ม')
      expect(container.textContent).toContain('— kg CO2')
    })

    it('shows the real numbers once the rates are there', async () => {
      app.wasteRates = { plastic: { carbonFactor: 1.031, pointsPerKg: 6 } }
      await render()

      await typeWeight('3')

      expect(container.textContent).toContain('18 แต้ม') // 3 × 6
      expect(container.textContent).toContain('3.0930 kg CO2') // 3 × 1.031
    })

    it('still lets the record be deleted while the rates are unknown', async () => {
      app.wasteRates = null

      await render()

      expect(buttons('ลบรายการ')).toHaveLength(1)
    })
  })
})
