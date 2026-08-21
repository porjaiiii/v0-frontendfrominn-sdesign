import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('merges multiple class strings', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('lets the later tailwind class win on conflict', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('drops falsy values', () => {
    expect(cn('px-2', false, undefined, null, '')).toBe('px-2')
  })

  it('supports conditional object syntax', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active')
  })

  it('flattens arrays', () => {
    expect(cn(['px-2', 'py-1'])).toBe('px-2 py-1')
  })

  it('returns an empty string with no usable input', () => {
    expect(cn()).toBe('')
  })
})
