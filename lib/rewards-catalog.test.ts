import { describe, expect, it } from 'vitest'

import { CASH_REWARD_ID, nextRewardId } from '@/lib/rewards-catalog'

const cash = [
  { id: 99, isVariable: true },
  { id: CASH_REWARD_ID, isVariable: true },
]

describe('nextRewardId', () => {
  it('continues from the highest ordinary reward, ignoring the cash-back rows', () => {
    const seeded = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, isVariable: false }))
    expect(nextRewardId([...seeded, ...cash])).toBe(8)
  })

  it('skips 99 and 100 once the sequence reaches them', () => {
    expect(nextRewardId([{ id: 98, isVariable: false }, ...cash])).toBe(101)
  })

  it('skips the reserved cash ids even when those rows are missing', () => {
    expect(nextRewardId([{ id: 98, isVariable: false }])).toBe(101)
  })

  it('keeps counting past 100 once ordinary rewards live there', () => {
    expect(nextRewardId([{ id: 101, isVariable: false }, ...cash])).toBe(102)
  })

  it('never hands out an id that is already taken', () => {
    expect(
      nextRewardId([
        { id: 7, isVariable: false },
        { id: 8, isVariable: true },
        ...cash,
      ]),
    ).toBe(9)
  })

  it('starts at 1 on an empty table', () => {
    expect(nextRewardId([])).toBe(1)
  })
})
