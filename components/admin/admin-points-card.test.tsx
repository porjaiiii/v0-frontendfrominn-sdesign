// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/api-client', () => api)

import { AdminPointsCard } from './admin-points-card'

// Staff at the scanner or profile view, looking at somebody else's balance.
// Their own /api/points would answer 403 for that id, so this must go through
// the staff route.

const USER = 'U scanned/user'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('AdminPointsCard', () => {
  let container: HTMLDivElement
  let root: Root

  async function render() {
    await act(async () => {
      root.render(<AdminPointsCard userId={USER} />)
    })
  }

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    api.apiFetch.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("reads the user's points from the staff route", async () => {
    api.apiFetch.mockResolvedValue(json(200, { success: true, account: { total_points: 1234 } }))

    await render()

    expect(api.apiFetch).toHaveBeenCalledWith(
      `/api/admin/points?user_id=${encodeURIComponent(USER)}`,
      expect.anything(),
    )
    expect(container.textContent).toContain('1,234')
  })

  it('shows 0 for a user who has not earned anything yet', async () => {
    api.apiFetch.mockResolvedValue(json(200, { success: true, account: null }))

    await render()

    expect(container.textContent).toContain('0')
    expect(container.textContent).not.toContain('ไม่สามารถ')
  })

  // Confirming a record in the cart below awards points; the card must not
  // keep showing the balance from before.
  it('reloads when refreshKey changes', async () => {
    api.apiFetch
      .mockResolvedValueOnce(json(200, { success: true, account: { total_points: 10 } }))
      .mockResolvedValueOnce(json(200, { success: true, account: { total_points: 22 } }))

    await act(async () => {
      root.render(<AdminPointsCard userId={USER} refreshKey={0} />)
    })
    await act(async () => {
      root.render(<AdminPointsCard userId={USER} refreshKey={1} />)
    })

    expect(api.apiFetch).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('22')
  })

  it('says so when the points cannot be loaded', async () => {
    api.apiFetch.mockResolvedValue(json(401, { error: 'Unauthorized' }))

    await render()

    expect(container.textContent).toContain('ไม่สามารถโหลดคะแนนได้')
  })
})
