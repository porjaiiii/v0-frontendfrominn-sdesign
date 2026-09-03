// Pure transform: raw GAS #1 (registration) Sheets rows -> app.* shaped records.
//
// The sibling of transform-points.ts, and deliberately the same shape: no I/O,
// header-indexed rather than positional, every rejected row surfaced as a
// QuarantinedRow rather than dropped. export.ts fetches, load.ts writes.
//
// GAS #1 is a BOUND script, so its spreadsheet id is not in its source. It was
// recoverable anyway — app/api/points/ranking/route.ts:33 carries it as a
// hardcoded fallback, which is where REGISTRATION_SHEETS_ID came from.
//
// What the real sheet ("DATABASE บัญชีขยะดิจิทัล", exported 2026-08-23) actually
// contains, and therefore what this file is built to survive:
//
//   Registration  53 rows = 2 blank + 51 real -> 39 distinct users (12 re-submits)
//   submission    31 rows = 1 blank + 30 real, one free-text waste_subtype
//   coupons       13 rows, all tx_ids resolve, all used rows carry used_at
//   AdminKeys     12 rows, status spelled 'inactive' where the schema says 'unused'
//
// Every reference column (เพศ / ช่วงอายุ / ประเภทผู้ใช้งาน / ตำบล / อาชีพ) is an FK
// to an app.ref_* table. Blank cells therefore become NULL, never '' — '' is
// not a row in those tables and would fail the constraint.

import { num, requireColumns, str, toISODateTime } from './transform-points'
import type { QuarantinedRow } from './transform-points'
import { isSheetsSerial, serialToISODate } from './serial-date'
import type { CellValue } from './sheets-client'

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

/** '' -> null, for every column that is nullable and/or an FK. */
function orNull(value: CellValue): string | null {
  const s = str(value)
  return s === '' ? null : s
}

/**
 * Thrown for a row that is simply an empty line in the spreadsheet. Reported,
 * but flagged benign so it never blocks the load — see QuarantinedRow.benign.
 */
class BlankRowError extends Error {}

function quarantine(tab: string, rowIndex: number, row: CellValue[], err: unknown): QuarantinedRow {
  const entry: QuarantinedRow = {
    tab,
    rowIndex,
    reason: err instanceof Error ? err.message : String(err),
    raw: row,
  }
  if (err instanceof BlankRowError) entry.benign = true
  return entry
}

// ---------------------------------------------------------------------------
// Registration -> app.users
// ---------------------------------------------------------------------------

export interface LegacyUser {
  line_user_id: string
  display_user_id: string | null
  pdpa_consent: string | null
  full_name: string | null
  nickname: string | null
  phone_number: string | null
  gender: string | null
  age_range: string | null
  user_type: string | null
  address: string | null
  subdistrict: string | null
  occupation: string | null
  /** The th-TH string the sheet shows, byte for byte. */
  registration_date_th: string | null
  registered_at: string
  is_legacy: true
}

/**
 * 'd/m/พ.ศ.' -> the UTC instant of that Bangkok calendar day's midnight.
 *
 * GAS wrote `new Date().toLocaleDateString('th-TH')`, so the year is Buddhist
 * (2569 = 2026) and the day/month are unpadded. The sheet's own string is kept
 * verbatim in registration_date_th; this is only the machine-readable twin.
 *
 * A date-only value has no time of day, and midnight is the sole defensible
 * stand-in. It is never shown to a user — the UI reads registration_date_th.
 */
function thaiDateToInstant(value: CellValue): string {
  // A cell whose format let Sheets auto-detect it comes back as a serial.
  const raw = isSheetsSerial(value) ? serialToISODate(value) : str(value)
  if (raw === '') throw new Error('missing วันที่สมัคร — users.registered_at is NOT NULL')

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (iso) {
    const [, y, m, d] = iso
    return bangkokMidnight(Number(y), Number(m), Number(d))
  }

  const thai = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw)
  if (!thai) throw new Error(`unparseable วันที่สมัคร: ${JSON.stringify(value)}`)

  const [, d, m, y] = thai
  const year = Number(y)
  // 2400 splits the two eras with ~350 years of margin either side; no real
  // Gregorian year in this data can reach it and no Buddhist year falls below.
  return bangkokMidnight(year > 2400 ? year - 543 : year, Number(m), Number(d))
}

function bangkokMidnight(year: number, month: number, day: number): string {
  const utcMidnight = Date.UTC(year, month - 1, day)
  const instant = new Date(utcMidnight - BANGKOK_OFFSET_MS)
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`invalid date ${year}-${month}-${day}`)
  }
  return instant.toISOString()
}

const REGISTRATION_COLUMNS = [
  'LINE User ID',
  'User ID',
  'PDPA Consent',
  'ชื่อ-นามสกุล',
  'ชื่อเล่น',
  'เบอร์ติดต่อ',
  'เพศ',
  'ช่วงอายุ',
  'ประเภทผู้ใช้งาน',
  'ที่อยู่',
  'ตำบล',
  'อาชีพ',
  'วันที่สมัคร',
]

export function transformRegistration(rows: CellValue[][]): {
  users: LegacyUser[]
  quarantined: QuarantinedRow[]
  /** How many rows were dropped as re-submits of a user already seen. */
  duplicatesCollapsed: number
} {
  if (rows.length === 0) return { users: [], quarantined: [], duplicatesCollapsed: 0 }
  const idx = requireColumns(rows[0], REGISTRATION_COLUMNS, 'Registration')
  const at = (row: CellValue[], name: string) => row[idx.get(name)!]

  // Keyed by line_user_id: a later row REPLACES an earlier one wholesale.
  //
  // Whole-row rather than field-by-field on purpose. Of the three re-submits
  // that actually differ, one corrects อาชีพ ('อื่นๆ' -> a real occupation)
  // while shortening ที่อยู่ in the same submission. A per-field "prefer the
  // longer value" merge would keep the old occupation next to the new address,
  // producing a profile the user never entered in one sitting.
  const byUser = new Map<string, LegacyUser>()
  const quarantined: QuarantinedRow[] = []
  let duplicatesCollapsed = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const rowIndex = i + 1

    try {
      const lineUserId = str(at(row, 'LINE User ID'))
      if (!lineUserId) {
        // Rows 2-3 of the real sheet are blank and sit in the MIDDLE, so this
        // cannot be treated as a trailing-row artifact and skipped quietly.
        throw new BlankRowError('blank row — no LINE User ID')
      }

      if (byUser.has(lineUserId)) duplicatesCollapsed++

      byUser.set(lineUserId, {
        line_user_id: lineUserId,
        display_user_id: orNull(at(row, 'User ID')),
        pdpa_consent: orNull(at(row, 'PDPA Consent')),
        full_name: orNull(at(row, 'ชื่อ-นามสกุล')),
        nickname: orNull(at(row, 'ชื่อเล่น')),
        phone_number: orNull(at(row, 'เบอร์ติดต่อ')),
        gender: orNull(at(row, 'เพศ')),
        age_range: orNull(at(row, 'ช่วงอายุ')),
        user_type: orNull(at(row, 'ประเภทผู้ใช้งาน')),
        address: orNull(at(row, 'ที่อยู่')),
        subdistrict: orNull(at(row, 'ตำบล')),
        occupation: orNull(at(row, 'อาชีพ')),
        registration_date_th: orNull(at(row, 'วันที่สมัคร')),
        registered_at: thaiDateToInstant(at(row, 'วันที่สมัคร')),
        is_legacy: true,
      })
    } catch (err) {
      quarantined.push(quarantine('Registration', rowIndex, row, err))
    }
  }

  return { users: [...byUser.values()], quarantined, duplicatesCollapsed }
}

// ---------------------------------------------------------------------------
// submission -> app.waste_records
// ---------------------------------------------------------------------------

/** Mirrors app.waste_subtypes exactly (0003_seed_catalog.sql). */
const WASTE_SUBTYPES: Record<string, string[]> = {
  plastic: ['pet', 'hdpe', 'ldpe'],
  paper: ['cardboard', 'a4', 'mixed'],
  glass: ['clear', 'colored'],
  aluminum: ['can', 'plate', 'scrap'],
  oil: ['cooking', 'motor'],
}

/**
 * Free text a human typed into what is otherwise an id column, mapped to the
 * id it unambiguously names. One entry, because the real sheet has exactly one
 * such row — this is a lookup table of known values, not a fuzzy matcher.
 */
const SUBTYPE_ALIASES: Record<string, { wasteType: string; subtype: string }> = {
  'ขวดน้ำพลาสติกใส': { wasteType: 'plastic', subtype: 'pet' },
}

const WASTE_STATUSES = new Set(['pending', 'done', 'cancelled'])

export interface LegacyWasteRecord {
  line_user_id: string
  waste_type_id: string
  waste_subtype_id: string | null
  /** NULL = "not yet weighed". 0 would trip waste_records_weight_positive. */
  weight_kg: number | null
  image_urls: string[]
  carbon_reduction_kg: number
  points_earned: number
  status: 'pending' | 'done' | 'cancelled'
  notes: string | null
  /** Deterministic, so re-running the load is a no-op rather than a duplicate. */
  idempotency_key: string
  recorded_at: string
  is_legacy: true
}

/**
 * image_url holds either a JSON array of URLs or a single bare URL, depending
 * on which version of the client wrote the row.
 *
 * blob:/data: entries are dropped rather than quarantined: they come from
 * components/waste-detail-modal.tsx persisting URL.createObjectURL() when an
 * upload failed, so they are already dead references in the source. Keeping
 * them would fail waste_records_no_local_urls; dropping the whole record would
 * lose a real weighing over a broken thumbnail.
 */
function parseImageUrls(value: CellValue): { urls: string[]; dropped: string[] } {
  const raw = str(value)
  if (raw === '') return { urls: [], dropped: [] }

  let candidates: string[]
  if (raw.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(raw)
      candidates = Array.isArray(parsed) ? parsed.map((v) => String(v ?? '').trim()) : [raw]
    } catch {
      candidates = [raw]
    }
  } else {
    candidates = [raw]
  }

  const urls: string[] = []
  const dropped: string[] = []
  for (const c of candidates) {
    if (c === '') continue
    if (/^\s*(blob|data):/i.test(c)) dropped.push(c)
    else urls.push(c)
  }
  return { urls, dropped }
}

const SUBMISSION_COLUMNS = [
  'timestamp',
  'user_id',
  'waste_type',
  'waste_subtype',
  'weight_kg',
  'image_url',
  'carbon_reduction',
  'points_earned',
  'status',
]

export function transformSubmission(rows: CellValue[][]): {
  records: LegacyWasteRecord[]
  quarantined: QuarantinedRow[]
} {
  if (rows.length === 0) return { records: [], quarantined: [] }
  const idx = requireColumns(rows[0], SUBMISSION_COLUMNS, 'submission')
  const at = (row: CellValue[], name: string) => row[idx.get(name)!]

  const records: LegacyWasteRecord[] = []
  const quarantined: QuarantinedRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const rowIndex = i + 1

    try {
      const lineUserId = str(at(row, 'user_id'))
      if (!lineUserId) throw new BlankRowError('blank row — no user_id')

      const wasteType = str(at(row, 'waste_type'))
      if (!WASTE_SUBTYPES[wasteType]) {
        throw new Error(`unknown waste_type "${wasteType}" — app.waste_types has no such id`)
      }

      const notes: string[] = []

      const rawSubtype = str(at(row, 'waste_subtype'))
      let subtype: string | null = null
      if (rawSubtype !== '') {
        if (WASTE_SUBTYPES[wasteType].includes(rawSubtype)) {
          subtype = rawSubtype
        } else if (SUBTYPE_ALIASES[rawSubtype]) {
          const alias = SUBTYPE_ALIASES[rawSubtype]
          if (alias.wasteType !== wasteType) {
            throw new Error(
              `waste_subtype "${rawSubtype}" maps to ${alias.wasteType}/${alias.subtype}, ` +
                `but this row says waste_type "${wasteType}"`,
            )
          }
          subtype = alias.subtype
          notes.push(`waste_subtype ตามชีตเดิม: "${rawSubtype}" → ${alias.subtype}`)
        } else if (Object.values(WASTE_SUBTYPES).some((list) => list.includes(rawSubtype))) {
          // A real id, but belonging to another material — the composite FK
          // (waste_type_id, waste_subtype_id) would reject the pair.
          throw new Error(
            `waste_subtype "${rawSubtype}" does not belong to waste_type "${wasteType}"`,
          )
        } else {
          throw new Error(`unknown waste_subtype "${rawSubtype}"`)
        }
      }

      const rawStatus = str(at(row, 'status'))
      if (!WASTE_STATUSES.has(rawStatus)) {
        throw new Error(`unknown status "${rawStatus}" — waste_records_status_check would reject it`)
      }
      const status = rawStatus as LegacyWasteRecord['status']

      // The legacy sentinel for "not yet weighed" is -1; an empty cell and a
      // literal 0 mean the same thing and are equally illegal as a number.
      const rawWeight = num(at(row, 'weight_kg'))
      const weight = rawWeight > 0 ? rawWeight : null
      if (status === 'done' && weight === null) {
        throw new Error(
          'status is done but weight_kg is empty — waste_records_done_needs_weight would reject it',
        )
      }

      const { urls, dropped } = parseImageUrls(at(row, 'image_url'))
      if (dropped.length > 0) {
        notes.push(`ตัด local URL ที่ใช้ไม่ได้ออก ${dropped.length} รายการ: ${dropped.join(', ')}`)
      }

      records.push({
        line_user_id: lineUserId,
        waste_type_id: wasteType,
        waste_subtype_id: subtype,
        weight_kg: weight,
        image_urls: urls,
        carbon_reduction_kg: num(at(row, 'carbon_reduction')),
        points_earned: Math.round(num(at(row, 'points_earned'))),
        status,
        notes: notes.length > 0 ? notes.join(' | ') : null,
        idempotency_key: `legacy:submission:${rowIndex}`,
        recorded_at: toISODateTime(at(row, 'timestamp')),
        is_legacy: true,
      })
    } catch (err) {
      quarantined.push(quarantine('submission', rowIndex, row, err))
    }
  }

  return { records, quarantined }
}

// ---------------------------------------------------------------------------
// coupons -> app.coupons
// ---------------------------------------------------------------------------

const COUPON_STATUSES = new Set(['active', 'used', 'expired', 'cancelled'])
const REDEEM_TYPES = new Set(['pickup', 'delivery'])

export interface LegacyCoupon {
  /** Verbatim — this string IS the QR payload in someone's phone right now. */
  coupon_id: string
  line_user_id: string
  reward_id: number | null
  reward_name: string
  reward_description: string
  reward_image: string
  points_used: number
  tx_id: string | null
  status: 'active' | 'used' | 'expired' | 'cancelled'
  redeemed_at: string
  used_at: string | null
  expires_at: string | null
  scanned_by: string | null
  redeem_type: string | null
  is_legacy: true
}

const COUPON_COLUMNS = [
  'coupon_id',
  'user_id',
  'reward_id',
  'reward_name',
  'points_used',
  'status',
  'redeemed_at',
]

export function transformCoupons(rows: CellValue[][]): {
  coupons: LegacyCoupon[]
  quarantined: QuarantinedRow[]
} {
  if (rows.length === 0) return { coupons: [], quarantined: [] }
  const idx = requireColumns(rows[0], COUPON_COLUMNS, 'coupons')
  const at = (row: CellValue[], name: string) => (idx.has(name) ? row[idx.get(name)!] : '')

  const coupons: LegacyCoupon[] = []
  const quarantined: QuarantinedRow[] = []
  const seen = new Set<string>()

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const rowIndex = i + 1

    try {
      const couponId = str(at(row, 'coupon_id'))
      if (!couponId) throw new BlankRowError('blank row — no coupon_id')
      if (seen.has(couponId)) throw new Error(`duplicate coupon_id ${couponId}`)
      seen.add(couponId)

      const lineUserId = str(at(row, 'user_id'))
      if (!lineUserId) throw new Error('missing user_id')

      const status = str(at(row, 'status'))
      if (!COUPON_STATUSES.has(status)) {
        throw new Error(`unknown status "${status}" — coupons_status_check would reject it`)
      }

      const usedAt = orNull(at(row, 'used_at'))
      if (status === 'used' && usedAt === null) {
        throw new Error(
          'status is used but used_at is empty — coupons_used_needs_timestamp would reject it',
        )
      }

      const redeemType = orNull(at(row, 'redeem_type'))
      if (redeemType !== null && !REDEEM_TYPES.has(redeemType)) {
        throw new Error(
          `unknown redeem_type "${redeemType}" — coupons_redeem_type_check would reject it`,
        )
      }

      const rewardIdRaw = str(at(row, 'reward_id'))

      coupons.push({
        coupon_id: couponId,
        line_user_id: lineUserId,
        reward_id: rewardIdRaw === '' ? null : Math.round(num(at(row, 'reward_id'))),
        reward_name: str(at(row, 'reward_name')),
        reward_description: str(at(row, 'reward_description')),
        reward_image: str(at(row, 'reward_image')),
        points_used: Math.max(0, Math.round(num(at(row, 'points_used')))),
        tx_id: orNull(at(row, 'tx_id')),
        status: status as LegacyCoupon['status'],
        redeemed_at: toISODateTime(at(row, 'redeemed_at')),
        used_at: usedAt === null ? null : toISODateTime(at(row, 'used_at')),
        expires_at: orNull(at(row, 'expires_at')) === null ? null : toISODateTime(at(row, 'expires_at')),
        scanned_by: orNull(at(row, 'scanned_by')),
        redeem_type: redeemType,
        is_legacy: true,
      })
    } catch (err) {
      quarantined.push(quarantine('coupons', rowIndex, row, err))
    }
  }

  return { coupons, quarantined }
}

// ---------------------------------------------------------------------------
// AdminKeys -> app.admin_keys
// ---------------------------------------------------------------------------

export interface LegacyAdminKey {
  key: string
  status: 'unused' | 'active' | 'revoked'
  line_user_id: string | null
  activated_at: string | null
}

/**
 * The sheet says 'inactive' for a key nobody has claimed; the schema's
 * admin_keys_status_check spells that state 'unused'. Eight of the twelve real
 * rows are in it, so this rename is the difference between the whole tab
 * loading and none of it loading.
 */
const ADMIN_STATUS: Record<string, LegacyAdminKey['status']> = {
  inactive: 'unused',
  unused: 'unused',
  active: 'active',
  revoked: 'revoked',
}

export function transformAdminKeys(rows: CellValue[][]): {
  keys: LegacyAdminKey[]
  quarantined: QuarantinedRow[]
} {
  if (rows.length === 0) return { keys: [], quarantined: [] }
  const idx = requireColumns(rows[0], ['admin_key', 'status'], 'AdminKeys')
  const at = (row: CellValue[], name: string) => (idx.has(name) ? row[idx.get(name)!] : '')

  const keys: LegacyAdminKey[] = []
  const quarantined: QuarantinedRow[] = []
  const seen = new Set<string>()

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const rowIndex = i + 1

    try {
      const key = str(at(row, 'admin_key'))
      if (!key) throw new BlankRowError('blank row — no admin_key')
      if (seen.has(key)) throw new Error(`duplicate admin_key ${key}`)
      seen.add(key)

      const rawStatus = str(at(row, 'status')).toLowerCase()
      const status = ADMIN_STATUS[rawStatus]
      if (!status) {
        throw new Error(`unknown status "${rawStatus}" — admin_keys_status_check would reject it`)
      }

      const lineUserId = orNull(at(row, 'line_user_id'))
      if (status === 'active' && lineUserId === null) {
        throw new Error(
          'status is active but line_user_id is empty — admin_keys_active_needs_user would reject it',
        )
      }

      const activatedAtRaw = orNull(at(row, 'activated_at'))

      keys.push({
        key,
        status,
        line_user_id: lineUserId,
        activated_at: activatedAtRaw === null ? null : toISODateTime(at(row, 'activated_at')),
      })
    } catch (err) {
      quarantined.push(quarantine('AdminKeys', rowIndex, row, err))
    }
  }

  return { keys, quarantined }
}
