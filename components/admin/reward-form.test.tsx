// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const upload = vi.hoisted(() => ({ uploadCatalogImage: vi.fn() }))

vi.mock('@/lib/api-client', () => ({ uploadCatalogImage: upload.uploadCatalogImage }))
vi.mock('@/lib/compress-image', () => ({
  compressImage: vi.fn(async () => ({
    dataUrl: 'data:image/jpeg;base64,AAAA',
    blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
  })),
}))

import { RewardForm, type RewardFormValues } from './reward-form'

// The form app/admin/rewards/new and app/admin/rewards/[id]/edit share. It
// turns what the admin typed into the PATCH/POST body fields — the part that
// can quietly send the wrong thing (an empty stock box as 0 instead of
// unlimited, a repriced cash-back reward, an image nobody uploaded).

const biochar = {
  name: 'ถ่านไบโอชาร์',
  description: '1 กิโลกรัม',
  points: 50,
  stock: null,
  image: '/images/rewards/biochar.jpg',
}

describe('RewardForm', () => {
  let container: HTMLDivElement
  let root: Root
  let onSubmit: ReturnType<typeof vi.fn<(values: RewardFormValues) => Promise<void>>>

  const field = (name: string) =>
    container.querySelector(`input[name="${name}"]`) as HTMLInputElement

  const type = async (name: string, value: string) => {
    await act(async () => {
      const input = field(name)
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

  const render = async (props: Partial<Parameters<typeof RewardForm>[0]> = {}) => {
    await act(async () => {
      root.render(<RewardForm onSubmit={onSubmit} {...props} />)
    })
  }

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onSubmit = vi.fn(async () => {})
    upload.uploadCatalogImage.mockReset()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('fills in an existing reward, with unlimited stock as an empty box', async () => {
    await render({ initial: { ...biochar, stock: null } })

    expect(field('name').value).toBe('ถ่านไบโอชาร์')
    expect(field('description').value).toBe('1 กิโลกรัม')
    expect(field('points').value).toBe('50')
    expect(field('stock').value).toBe('')
  })

  it('sends an empty stock box as unlimited (null), not 0', async () => {
    await render({ initial: { ...biochar, stock: 4 } })

    await type('name', 'ถ่านไบโอชาร์ถุงใหญ่')
    await type('stock', '')
    await submit()

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'ถ่านไบโอชาร์ถุงใหญ่',
      description: '1 กิโลกรัม',
      points: 50,
      stock: null,
    })
    expect(upload.uploadCatalogImage).not.toHaveBeenCalled()
  })

  it('uploads a newly picked photo and sends its storage path', async () => {
    upload.uploadCatalogImage.mockResolvedValue('rewards/new.jpg')
    await render({ initial: biochar })

    await act(async () => {
      const input = container.querySelector('input[type="file"]') as HTMLInputElement
      Object.defineProperty(input, 'files', {
        value: [new File(['raw'], 'photo.jpg', { type: 'image/jpeg' })],
      })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await submit()

    expect(upload.uploadCatalogImage).toHaveBeenCalledWith(expect.any(Blob), 'rewards')
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ imagePath: 'rewards/new.jpg' }))
  })

  it('refuses to submit a blank name', async () => {
    await render({ initial: biochar })

    await type('name', '   ')
    await submit()

    expect(onSubmit).not.toHaveBeenCalled()
    expect(container.textContent).toContain('กรุณาระบุชื่อของรางวัล')
  })

  it('refuses to submit zero points', async () => {
    await render({ initial: biochar })

    await type('points', '0')
    await submit()

    expect(onSubmit).not.toHaveBeenCalled()
    expect(container.textContent).toContain('กรุณาระบุคะแนนที่ถูกต้อง')
  })

  it('locks points on the variable cash-back reward and leaves them out', async () => {
    await render({ initial: { ...biochar, points: 1 }, pointsLocked: true })

    expect(field('points').disabled).toBe(true)
    await submit()

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('points')
  })

  it('shows a failed save and lets the admin try again', async () => {
    onSubmit.mockRejectedValueOnce(new Error('ไม่สามารถบันทึกของรางวัลได้'))
    await render({ initial: biochar })

    await submit()

    expect(container.textContent).toContain('ไม่สามารถบันทึกของรางวัลได้')
    const button = container.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(button.disabled).toBe(false)
  })
})
