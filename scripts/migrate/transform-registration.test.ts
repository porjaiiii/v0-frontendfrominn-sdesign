import { describe, expect, it } from 'vitest'

import type { CellValue } from './sheets-client'
import {
  transformAdminKeys,
  transformCoupons,
  transformRegistration,
  transformSubmission,
} from './transform-registration'

// Fixtures mirror the REAL header rows of "DATABASE บัญชีขยะดิจิทัล"
// (REGISTRATION_SHEETS_ID, exported 2026-08-23). Values are synthetic — the
// shapes, the Thai column names and the quirks are not.

const REG_HEADER = [
  'LINE User ID', 'User ID', 'PDPA Consent', 'ชื่อ-นามสกุล', 'ชื่อเล่น', 'เบอร์ติดต่อ',
  'เพศ', 'ช่วงอายุ', 'ประเภทผู้ใช้งาน', 'ที่อยู่', 'ตำบล', 'อาชีพ', 'วันที่สมัคร',
]

const regRow = (over: Record<string, CellValue> = {}): CellValue[] => {
  const base: Record<string, CellValue> = {
    'LINE User ID': 'U0000000000000000000000000000001',
    'User ID': 'DW1917449410',
    'PDPA Consent': 'ยอมรับ',
    'ชื่อ-นามสกุล': 'สมชาย ใจดี',
    'ชื่อเล่น': 'ชาย',
    'เบอร์ติดต่อ': '0812345678',
    'เพศ': 'ชาย',
    'ช่วงอายุ': '26-45',
    'ประเภทผู้ใช้งาน': 'คนในชุมชนคุ้งบางกะเจ้า',
    'ที่อยู่': '1/2 หมู่ 3',
    'ตำบล': 'บางยอ',
    'อาชีพ': 'เกษตรกร',
    'วันที่สมัคร': '19/8/2569',
    ...over,
  }
  return REG_HEADER.map((h) => base[h] ?? '')
}

describe('transformRegistration', () => {
  it('maps a normal row onto an app.users record, is_legacy flagged', () => {
    const { users, quarantined } = transformRegistration([REG_HEADER, regRow()])

    expect(quarantined).toEqual([])
    expect(users).toHaveLength(1)
    expect(users[0]).toMatchObject({
      line_user_id: 'U0000000000000000000000000000001',
      display_user_id: 'DW1917449410',
      full_name: 'สมชาย ใจดี',
      nickname: 'ชาย',
      phone_number: '0812345678',
      gender: 'ชาย',
      subdistrict: 'บางยอ',
      occupation: 'เกษตรกร',
      is_legacy: true,
    })
  })

  it('preserves the Thai date verbatim AND converts พ.ศ. to a Bangkok-midnight instant', () => {
    const { users } = transformRegistration([REG_HEADER, regRow()])

    // Lossless: the string the sheet shows survives untouched...
    expect(users[0].registration_date_th).toBe('19/8/2569')
    // ...and 2569 - 543 = 2026. Midnight in Bangkok is 17:00 UTC the day before.
    expect(users[0].registered_at).toBe('2026-08-18T17:00:00.000Z')
  })

  it('maps an EMPTY reference value to null, never to an empty string', () => {
    // '' would violate the FK to app.ref_gender etc.; null is what the column
    // is nullable FOR. Four real rows have a blank ตำบล.
    const { users, quarantined } = transformRegistration([
      REG_HEADER,
      regRow({ 'เพศ': '', 'ตำบล': '', 'อาชีพ': '' }),
    ])

    expect(quarantined).toEqual([])
    expect(users[0].gender).toBeNull()
    expect(users[0].subdistrict).toBeNull()
    expect(users[0].occupation).toBeNull()
  })

  it('quarantines a blank row rather than skipping it silently', () => {
    // Rows 2 and 3 of the real sheet are blank — in the MIDDLE, not trailing.
    const { users, quarantined } = transformRegistration([
      REG_HEADER,
      REG_HEADER.map((): CellValue => ''),
      regRow(),
    ])

    expect(users).toHaveLength(1)
    expect(quarantined).toHaveLength(1)
    expect(quarantined[0].rowIndex).toBe(2)
    expect(quarantined[0].reason).toMatch(/LINE User ID/)
  })

  it('collapses a duplicated line_user_id to the LAST row, whole-row', () => {
    // 12 of the 51 real rows are re-submits. Three pairs differ: a later row
    // corrected อาชีพ from 'อื่นๆ' to a specific value while shortening ที่อยู่.
    // Last-wins takes both halves of that edit, not a per-field merge.
    const { users, quarantined } = transformRegistration([
      REG_HEADER,
      regRow({ 'ที่อยู่': '46/2 หมู่4 ตำบลบางยอ สมุทรปราการ', 'อาชีพ': 'อื่นๆ' }),
      regRow({ 'ที่อยู่': '46/2 หมู่4 บางยอ', 'อาชีพ': 'ผู้เกษียณอายุ/ว่างงาน' }),
    ])

    expect(quarantined).toEqual([])
    expect(users).toHaveLength(1)
    expect(users[0].address).toBe('46/2 หมู่4 บางยอ')
    expect(users[0].occupation).toBe('ผู้เกษียณอายุ/ว่างงาน')
  })

  it('rejects a sheet whose header lost an expected column', () => {
    expect(() => transformRegistration([REG_HEADER.filter((h) => h !== 'ตำบล'), regRow()])).toThrow(
      /ตำบล/,
    )
  })
})

const SUB_HEADER = [
  'timestamp', 'user_id', 'waste_type', 'waste_subtype', 'weight_kg',
  'image_url', 'carbon_reduction', 'points_earned', 'status',
]

const subRow = (over: Record<string, CellValue> = {}): CellValue[] => {
  const base: Record<string, CellValue> = {
    timestamp: 46252.66821138889, // a real Sheets serial, Asia/Bangkok
    user_id: 'U0000000000000000000000000000001',
    waste_type: 'plastic',
    waste_subtype: 'pet',
    weight_kg: 4.5,
    image_url: '',
    carbon_reduction: 4.6395,
    points_earned: 27,
    status: 'done',
    ...over,
  }
  return SUB_HEADER.map((h) => base[h] ?? '')
}

describe('transformSubmission', () => {
  it('maps a done row and decodes the Sheets serial to a UTC instant', () => {
    const { records, quarantined } = transformSubmission([SUB_HEADER, subRow()])

    expect(quarantined).toEqual([])
    expect(records[0]).toMatchObject({
      line_user_id: 'U0000000000000000000000000000001',
      waste_type_id: 'plastic',
      waste_subtype_id: 'pet',
      weight_kg: 4.5,
      points_earned: 27,
      status: 'done',
      is_legacy: true,
    })
    expect(records[0].recorded_at).toBe('2026-08-18T09:02:13.464Z')
  })

  it('gives every row a deterministic idempotency_key so a re-run cannot duplicate it', () => {
    // waste_records has no natural key. The partial unique index at
    // 0001_schema.sql:218 turns this into an on-conflict-do-nothing re-run.
    const { records } = transformSubmission([SUB_HEADER, subRow(), subRow({ weight_kg: 2 })])

    expect(records[0].idempotency_key).toBe('legacy:submission:2')
    expect(records[1].idempotency_key).toBe('legacy:submission:3')
  })

  it("maps the one free-text subtype 'ขวดน้ำพลาสติกใส' onto pet", () => {
    const { records, quarantined } = transformSubmission([
      SUB_HEADER,
      subRow({ waste_subtype: 'ขวดน้ำพลาสติกใส' }),
    ])

    expect(quarantined).toEqual([])
    expect(records[0].waste_subtype_id).toBe('pet')
    // The original text is kept, so the mapping is auditable after the fact.
    expect(records[0].notes).toMatch(/ขวดน้ำพลาสติกใส/)
  })

  it('quarantines a subtype that is neither valid nor a known alias', () => {
    const { records, quarantined } = transformSubmission([
      SUB_HEADER,
      subRow({ waste_subtype: 'ถุงกระสอบ' }),
    ])

    expect(records).toEqual([])
    expect(quarantined[0].reason).toMatch(/ถุงกระสอบ/)
  })

  it('quarantines a subtype belonging to a different waste_type', () => {
    // The composite FK (waste_type_id, waste_subtype_id) would reject this.
    const { records, quarantined } = transformSubmission([
      SUB_HEADER,
      subRow({ waste_type: 'glass', waste_subtype: 'pet' }),
    ])

    expect(records).toEqual([])
    expect(quarantined[0].reason).toMatch(/glass/)
  })

  it('parses the JSON-array image_url into a text[] and keeps legacy Drive URLs', () => {
    const drive = 'https://drive.google.com/thumbnail?id=17BkD_uEO'
    const { records } = transformSubmission([
      SUB_HEADER,
      subRow({ image_url: JSON.stringify([drive]) }),
    ])

    expect(records[0].image_urls).toEqual([drive])
  })

  it('accepts a bare (non-JSON) URL string too', () => {
    const drive = 'https://drive.google.com/thumbnail?id=17BkD_uEO'
    const { records } = transformSubmission([SUB_HEADER, subRow({ image_url: drive })])

    expect(records[0].image_urls).toEqual([drive])
  })

  it('drops blob:/data: URLs, which waste_records_no_local_urls would reject', () => {
    const drive = 'https://drive.google.com/thumbnail?id=17BkD_uEO'
    const { records } = transformSubmission([
      SUB_HEADER,
      subRow({ image_url: JSON.stringify([drive, 'blob:https://example.com/abc']) }),
    ])

    expect(records[0].image_urls).toEqual([drive])
    expect(records[0].notes).toMatch(/blob/)
  })

  it('maps a pending row with no weight to null, not 0', () => {
    // NULL is the schema's "not yet weighed"; 0 would trip
    // waste_records_weight_positive.
    const { records, quarantined } = transformSubmission([
      SUB_HEADER,
      subRow({ status: 'pending', weight_kg: '' }),
    ])

    expect(quarantined).toEqual([])
    expect(records[0].weight_kg).toBeNull()
    expect(records[0].status).toBe('pending')
  })

  it('quarantines a done row with no weight, which the CHECK would reject', () => {
    const { records, quarantined } = transformSubmission([
      SUB_HEADER,
      subRow({ status: 'done', weight_kg: '' }),
    ])

    expect(records).toEqual([])
    expect(quarantined[0].reason).toMatch(/done/)
  })

  it('quarantines an unknown status', () => {
    const { quarantined } = transformSubmission([SUB_HEADER, subRow({ status: 'อนุมัติ' })])
    expect(quarantined[0].reason).toMatch(/อนุมัติ/)
  })

  it('quarantines a blank row', () => {
    const { records, quarantined } = transformSubmission([SUB_HEADER, SUB_HEADER.map((): CellValue => '')])
    expect(records).toEqual([])
    expect(quarantined).toHaveLength(1)
  })
})

const CPN_HEADER = [
  'coupon_id', 'user_id', 'reward_id', 'reward_name', 'reward_description', 'reward_image',
  'points_used', 'tx_id', 'status', 'redeemed_at', 'used_at', 'expires_at', 'scanned_by', 'redeem_type',
]

const cpnRow = (over: Record<string, CellValue> = {}): CellValue[] => {
  const base: Record<string, CellValue> = {
    coupon_id: 'CPN12345678-abcd-ef01',
    user_id: 'U0000000000000000000000000000001',
    reward_id: 3,
    reward_name: 'ถุงผ้า',
    reward_description: 'ถุงผ้าลดโลกร้อน',
    reward_image: '',
    points_used: 120,
    tx_id: '94d9d2df-0533-4494-b46e-7933432ad72b',
    status: 'active',
    redeemed_at: '2026-08-18T09:40:00.000Z',
    used_at: '',
    expires_at: '',
    scanned_by: '',
    redeem_type: 'pickup',
    ...over,
  }
  return CPN_HEADER.map((h) => base[h] ?? '')
}

describe('transformCoupons', () => {
  it('preserves coupon_id verbatim — outstanding QR codes must keep resolving', () => {
    const { coupons, quarantined } = transformCoupons([CPN_HEADER, cpnRow()])

    expect(quarantined).toEqual([])
    expect(coupons[0]).toMatchObject({
      coupon_id: 'CPN12345678-abcd-ef01',
      reward_id: 3,
      points_used: 120,
      status: 'active',
      redeem_type: 'pickup',
      is_legacy: true,
    })
  })

  it('maps blank used_at / expires_at / scanned_by to null', () => {
    const { coupons } = transformCoupons([CPN_HEADER, cpnRow()])

    expect(coupons[0].used_at).toBeNull()
    expect(coupons[0].expires_at).toBeNull()
    expect(coupons[0].scanned_by).toBeNull()
  })

  it('keeps used_at on a used coupon', () => {
    const { coupons, quarantined } = transformCoupons([
      CPN_HEADER,
      cpnRow({ status: 'used', used_at: '2026-08-18T09:49:25.162Z' }),
    ])

    expect(quarantined).toEqual([])
    expect(coupons[0].used_at).toBe('2026-08-18T09:49:25.162Z')
  })

  it('quarantines a used coupon with no used_at, which coupons_used_needs_timestamp rejects', () => {
    const { coupons, quarantined } = transformCoupons([
      CPN_HEADER,
      cpnRow({ status: 'used', used_at: '' }),
    ])

    expect(coupons).toEqual([])
    expect(quarantined[0].reason).toMatch(/used_at/)
  })

  it('quarantines a status outside the CHECK constraint', () => {
    const { quarantined } = transformCoupons([CPN_HEADER, cpnRow({ status: 'redeemed' })])
    expect(quarantined[0].reason).toMatch(/redeemed/)
  })

  it('quarantines a redeem_type outside the CHECK constraint', () => {
    const { quarantined } = transformCoupons([CPN_HEADER, cpnRow({ redeem_type: 'ส่งเอง' })])
    expect(quarantined[0].reason).toMatch(/ส่งเอง/)
  })
})

const KEY_HEADER = ['admin_key', 'status', 'line_user_id', 'activated_at', 'Column 1']

const keyRow = (over: Record<string, CellValue> = {}): CellValue[] => {
  const base: Record<string, CellValue> = {
    admin_key: 'ADMIN-0001',
    status: 'inactive',
    line_user_id: '',
    activated_at: '',
    'Column 1': '',
    ...over,
  }
  return KEY_HEADER.map((h) => base[h] ?? '')
}

describe('transformAdminKeys', () => {
  it("renames the sheet's 'inactive' to the schema's 'unused'", () => {
    // admin_keys_status_check allows unused|active|revoked only. 8 of the 12
    // real rows say 'inactive'.
    const { keys, quarantined } = transformAdminKeys([KEY_HEADER, keyRow()])

    expect(quarantined).toEqual([])
    expect(keys[0]).toMatchObject({ key: 'ADMIN-0001', status: 'unused', line_user_id: null })
  })

  it('keeps an active key bound to its user', () => {
    const { keys, quarantined } = transformAdminKeys([
      KEY_HEADER,
      keyRow({
        status: 'active',
        line_user_id: 'U0000000000000000000000000000001',
        activated_at: '2026-08-18T09:49:25.162Z',
      }),
    ])

    expect(quarantined).toEqual([])
    expect(keys[0].status).toBe('active')
    expect(keys[0].activated_at).toBe('2026-08-18T09:49:25.162Z')
  })

  it('quarantines an active key with no user, which admin_keys_active_needs_user rejects', () => {
    const { keys, quarantined } = transformAdminKeys([
      KEY_HEADER,
      keyRow({ status: 'active', line_user_id: '' }),
    ])

    expect(keys).toEqual([])
    expect(quarantined[0].reason).toMatch(/line_user_id/)
  })

  it('quarantines a duplicate admin_key rather than letting the PK decide', () => {
    const { keys, quarantined } = transformAdminKeys([KEY_HEADER, keyRow(), keyRow()])

    expect(keys).toHaveLength(1)
    expect(quarantined[0].reason).toMatch(/duplicate/)
  })
})

describe('benign vs blocking quarantine', () => {
  // load.ts refuses to run while any row is quarantined. Three rows of the real
  // export are simply empty spreadsheet rows, which is not a defect to resolve
  // — without this distinction the loader could never run at all.
  it('marks a blank Registration row benign', () => {
    const { quarantined } = transformRegistration([REG_HEADER, REG_HEADER.map((): CellValue => '')])
    expect(quarantined[0].benign).toBe(true)
  })

  it('marks a blank submission row benign', () => {
    const { quarantined } = transformSubmission([SUB_HEADER, SUB_HEADER.map((): CellValue => '')])
    expect(quarantined[0].benign).toBe(true)
  })

  it('does NOT mark a real data problem benign', () => {
    const { quarantined } = transformSubmission([SUB_HEADER, subRow({ status: 'อนุมัติ' })])
    expect(quarantined[0].benign).toBeFalsy()
  })

  it('counts collapsed duplicates separately from quarantine', () => {
    const { users, quarantined, duplicatesCollapsed } = transformRegistration([
      REG_HEADER,
      regRow(),
      regRow(),
      regRow({ 'LINE User ID': 'U0000000000000000000000000000002' }),
    ])
    expect(users).toHaveLength(2)
    expect(quarantined).toEqual([])
    expect(duplicatesCollapsed).toBe(1)
  })
})
