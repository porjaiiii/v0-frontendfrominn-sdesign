import { describe, expect, it } from 'vitest'

import { OCCUPATIONS, SUBDISTRICTS } from '@/lib/registration-options'
import { registerUserSchema } from '@/lib/schemas/register'

// These fields used to be validated by foreign keys to app.ref_*. Those tables
// are gone (0011_drop_ref_tables.sql), so this schema is now the only thing
// standing between a crafted request and a junk value in a column that reports
// group by.

const valid = {
  pdpaConsent: 'ยอมรับ',
  fullName: 'ทดสอบ ระบบ',
  gender: 'หญิง',
  ageRange: '26-45',
  userType: 'คนในชุมชนคุ้งบางกะเจ้า',
  subdistrict: 'บางน้ำผึ้ง',
  occupation: 'เกษตรกร',
}

describe('registerUserSchema reference fields', () => {
  it('accepts the values the form offers', () => {
    const parsed = registerUserSchema.parse(valid)

    expect(parsed.gender).toBe('หญิง')
    expect(parsed.subdistrict).toBe('บางน้ำผึ้ง')
    expect(parsed.occupation).toBe('เกษตรกร')
  })

  it('rejects a value that is not on the list', () => {
    expect(() => registerUserSchema.parse({ ...valid, gender: 'ไม่มีเพศนี้' })).toThrow()
    expect(() => registerUserSchema.parse({ ...valid, subdistrict: 'ตำบลที่ไม่มีอยู่' })).toThrow()
    expect(() => registerUserSchema.parse({ ...valid, ageRange: '99-100' })).toThrow()
  })

  it('still lets a tourist leave subdistrict and occupation blank', () => {
    // The columns are nullable exactly for this case — a tourist has neither.
    const parsed = registerUserSchema.parse({
      ...valid,
      userType: 'นักท่องเที่ยว',
      subdistrict: '',
      occupation: '',
    })

    expect(parsed.subdistrict).toBeNull()
    expect(parsed.occupation).toBeNull()
  })

  it('accepts a payload that omits the optional fields entirely', () => {
    const parsed = registerUserSchema.parse({ pdpaConsent: 'ยอมรับ', fullName: 'ทดสอบ' })

    expect(parsed.gender).toBeNull()
    expect(parsed.occupation).toBeNull()
  })

  it('keeps the two lookalike "other" values apart', () => {
    // Occupation is 'อื่นๆ', subdistrict is 'อื่น ๆ' — one has a space. Both are
    // verbatim from 0003_seed_catalog.sql and a "tidy-up" would break the rows
    // already stored under them.
    expect(OCCUPATIONS).toContain('อื่นๆ')
    expect(SUBDISTRICTS).toContain('อื่น ๆ')
    expect(() => registerUserSchema.parse({ ...valid, occupation: 'อื่น ๆ' })).toThrow()
  })
})
