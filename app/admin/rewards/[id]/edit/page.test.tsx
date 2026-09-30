// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ back: vi.fn(), id: '3' }))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: nav.id }),
  useRouter: () => ({ back: nav.back, push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@/lib/admin-context', () => ({ useAdmin: () => ({ isAdmin: true }) }))
vi.mock('@/lib/api-client', () => ({ uploadCatalogImage: vi.fn() }))

import AdminEditRewardPage from './page'

// The reward editor: GET /api/catalog/rewards/[id] fills the form, and saving
// PATCHes only what the form produced, then returns to the list.

const biochar = {
  id: 3,
  name: 'ถ่านไบโอชาร์',
  description: '1 กิโลกรัม',
  points: 50,
  image: '/images/rewards/biochar.jpg',
  isVariable: false,
  minPoints: null,
  stock: null,
  isActive: false,
}

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

describe('AdminEditRewardPage', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  const field = (name: string) =>
    container.querySelector(`input[name="${name}"]`) as HTMLInputElement | null

  const type = async (name: string, value: string) => {
    await act(async () => {
      const input = field(name)!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  const submit = async () => {
    await act(async () => {
      const button = container.querySelector('button[type="submit"]') as HTMLButtonElement
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }

  const patchCall = () => fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')

  const render = async () => {
    await act(async () => {
      root.render(<AdminEditRewardPage />)
    })
  }

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    nav.back.mockReset()
    nav.id = '3'
    fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? json(200, { success: true, id: 3 })
        : json(200, { success: true, reward: biochar }),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the reward into the form', async () => {
    await render()

    expect(fetchMock).toHaveBeenCalledWith('/api/catalog/rewards/3')
    expect(field('name')?.value).toBe('ถ่านไบโอชาร์')
    expect(field('points')?.value).toBe('50')
  })

  it('saves the edits with a PATCH and goes back to the list', async () => {
    await render()

    await type('name', 'ถ่านไบโอชาร์ถุงใหญ่')
    await type('points', '80')
    await type('stock', '5')
    await submit()

    const [url, init] = patchCall()!
    expect(url).toBe('/api/catalog/rewards/3')
    expect(JSON.parse(init.body)).toEqual({
      name: 'ถ่านไบโอชาร์ถุงใหญ่',
      description: '1 กิโลกรัม',
      points: 80,
      stock: 5,
    })
    expect(nav.back).toHaveBeenCalled()
  })

  it('never sends points for the variable cash-back reward', async () => {
    nav.id = '100'
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? json(200, { success: true, id: 100 })
        : json(200, {
            success: true,
            reward: { ...biochar, id: 100, points: 1, isVariable: true, minPoints: 1 },
          }),
    )
    await render()

    expect(field('points')?.disabled).toBe(true)
    await submit()

    const [url, init] = patchCall()!
    expect(url).toBe('/api/catalog/rewards/100')
    expect(JSON.parse(init.body)).not.toHaveProperty('points')
  })

  it('keeps the admin on the page when the save is refused', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? json(400, { success: false, error: 'Invalid request' })
        : json(200, { success: true, reward: biochar }),
    )
    await render()

    await submit()

    expect(container.textContent).toContain('Invalid request')
    expect(nav.back).not.toHaveBeenCalled()
  })

  it('says so when the reward does not exist', async () => {
    fetchMock.mockImplementation(() => json(404, { error: 'ไม่พบของรางวัลนี้' }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await render()

    expect(container.textContent).toContain('ไม่พบของรางวัลนี้')
    expect(field('name')).toBeNull()
  })
})
