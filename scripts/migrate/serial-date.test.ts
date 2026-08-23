import { describe, expect, it } from 'vitest'

import {
  isSheetsSerial,
  serialToISODate,
  serialToISODateTime,
  utcInstantToSerial,
} from './serial-date'

// Fixtures: bare serial numbers read live from the real production points
// spreadsheet (POINTS_SPREADSHEET_ID, 2026-08-23) — not PII on their own, the
// user_id each came attached to is deliberately not reproduced here.

describe('serialToISODate', () => {
  it('decodes a real points_monthly.expires_at serial to the off-by-one date the sheet actually shows', () => {
    // month='2026-08'; getExpiresAt intended 2028-08-31 (last day of month,
    // EXPIRE_YEAR=2 later) but points/Code.gs:154-158's local-midnight-then-
    // toISOString() bug stores one day early. This is the value PHASE-0-
    // FINDINGS.md predicts and this test locks in — decoding it must NOT
    // "fix" the bug, since the sheet's stored value is the ground truth for a
    // lossless migration.
    expect(serialToISODate(46995)).toBe('2028-08-30')
  })

  it('has no time-of-day component to get wrong on a whole-number serial', () => {
    expect(serialToISODate(46995)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('serialToISODateTime', () => {
  it('decodes a real points_transactions.timestamp serial (from now_(), Asia/Bangkok)', () => {
    // now_() writes 'yyyy-MM-dd HH:mm:ss' Bangkok wall-clock, which Sheets
    // auto-converts to a serial with no timezone attached. 08:58:10 UTC here
    // means 15:58:10 Bangkok — the ACTUAL wall-clock instant that was on
    // screen when this row was written.
    expect(serialToISODateTime(46252.66539351852)).toBe('2026-08-18T08:58:10.000Z')
  })
})

describe('utcInstantToSerial / serialToISODateTime round-trip', () => {
  it('recovers the exact instant to the second', () => {
    const original = new Date('2026-08-18T08:58:10.000Z')
    const serial = utcInstantToSerial(original)
    expect(serialToISODateTime(serial)).toBe(original.toISOString())
  })

  it('round-trips a date-only value with no fractional drift', () => {
    const original = new Date('2028-08-30T00:00:00.000Z')
    // A date-only cell's serial is a whole number when it represents Bangkok
    // midnight — but utcInstantToSerial takes a UTC instant, so Bangkok
    // midnight (2028-08-30T00:00+07:00) is 2028-08-29T17:00Z, not the UTC
    // midnight this fixture uses. This test is about SECOND-level precision
    // surviving the round trip, not about which calendar day a UTC midnight
    // happens to land on in Bangkok.
    const serial = utcInstantToSerial(original)
    expect(serialToISODateTime(serial)).toBe(original.toISOString())
  })
})

describe('isSheetsSerial', () => {
  it('accepts a finite number', () => {
    expect(isSheetsSerial(46995)).toBe(true)
    expect(isSheetsSerial(46252.665)).toBe(true)
    expect(isSheetsSerial(0)).toBe(true)
  })

  it('rejects a literal ISO string — points_account.last_updated`s actual shape', () => {
    // Confirmed live: this column is written via
    // .setValue(new Date().toISOString()), a format Sheets' date
    // auto-detection does not recognise, so it stays plain text.
    expect(isSheetsSerial('2026-08-18T10:20:21.752Z')).toBe(false)
  })

  it('rejects NaN, Infinity and non-numeric values', () => {
    expect(isSheetsSerial(Number.NaN)).toBe(false)
    expect(isSheetsSerial(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isSheetsSerial(null)).toBe(false)
    expect(isSheetsSerial(undefined)).toBe(false)
    expect(isSheetsSerial(true)).toBe(false)
  })
})
