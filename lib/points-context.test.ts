import { describe, expect, it } from 'vitest'
import { toMetric, toNumber, toPoints } from '@/lib/points-context'

describe('toNumber', () => {
  it('passes numbers through', () => {
    expect(toNumber(42)).toBe(42)
    expect(toNumber(-1.5)).toBe(-1.5)
  })

  it('parses numeric strings', () => {
    expect(toNumber('42')).toBe(42)
    expect(toNumber('3.14')).toBe(3.14)
  })

  it('returns 0 for non-numeric, nullish, and non-finite values', () => {
    expect(toNumber('abc')).toBe(0)
    expect(toNumber('')).toBe(0)
    expect(toNumber(null)).toBe(0)
    expect(toNumber(undefined)).toBe(0)
    expect(toNumber(NaN)).toBe(0)
    expect(toNumber(Infinity)).toBe(0)
  })
})

describe('toPoints', () => {
  it('rounds to whole points', () => {
    expect(toPoints(10.4)).toBe(10)
    expect(toPoints(10.5)).toBe(11)
  })

  it('strips floating point artifacts from sheet sums', () => {
    expect(toPoints(829.9999999999)).toBe(830)
  })

  it('returns 0 for junk input', () => {
    expect(toPoints('abc')).toBe(0)
  })
})

describe('toMetric', () => {
  it('rounds to two decimal places', () => {
    expect(toMetric(1.234)).toBe(1.23)
    expect(toMetric(1.235)).toBe(1.24)
  })

  it('strips floating point artifacts', () => {
    expect(toMetric(2.30000000004)).toBe(2.3)
  })

  it('returns 0 for junk input', () => {
    expect(toMetric(null)).toBe(0)
  })
})
