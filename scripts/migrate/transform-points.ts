// Pure transform: raw points-side Sheets rows -> app.* shaped records.
//
// No I/O in this file — export.ts already did the fetching, load.ts (not
// written yet) will do the writing. Kept pure and deterministic so it's
// testable with plain fixtures, per the plan's "Transform functions — highest
// value in the project, because a transform bug is silent permanent data
// corruption."
//
// The central finding from Phase 0 that this whole file rests on
// (PHASE-0-FINDINGS.md): points_monthly is not an approximation of the
// ledger, it IS the ledger — one row already carries earned/spent/balance as
// three separate columns, so it maps 1:1 onto a point_lot with all three
// fields intact. That is what makes the zero-tolerance balance reconciliation
// gate achievable exactly rather than approximately.

import { isSheetsSerial, serialToISODate, serialToISODateTime } from './serial-date'
import type { CellValue } from './sheets-client'

// ---------------------------------------------------------------------------
// Row shapes, keyed by trimmed header name (not by position) — the sheet's
// column ORDER is trusted no further than its header text, so a tab that ever
// got a column reordered is caught, not silently misread.
// ---------------------------------------------------------------------------

export interface QuarantinedRow {
  tab: string
  rowIndex: number // 1-based, matching the sheet's own row numbers (header = 1)
  reason: string
  raw: CellValue[]
}

function indexHeader(header: CellValue[]): Map<string, number> {
  const index = new Map<string, number>()
  header.forEach((cell, i) => {
    const key = String(cell ?? '').trim()
    if (key) index.set(key, i)
  })
  return index
}

function requireColumns(header: CellValue[], required: string[], tab: string): Map<string, number> {
  const index = indexHeader(header)
  const missing = required.filter((c) => !index.has(c))
  if (missing.length > 0) {
    throw new Error(`[transform:${tab}] missing expected column(s): ${missing.join(', ')}`)
  }
  return index
}

function str(value: CellValue): string {
  return value == null ? '' : String(value).trim()
}

function num(value: CellValue): number {
  if (typeof value === 'number') return value
  const n = Number.parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * Both timestamp shapes points/Code.gs actually produces, disambiguated the
 * same way isSheetsSerial does: a real serial (from now_() or a Date object)
 * decodes through Asia/Bangkok; a literal ISO string
 * (.setValue(new Date().toISOString())) parses directly.
 */
function toISODateTime(value: CellValue): string {
  if (isSheetsSerial(value)) return serialToISODateTime(value)
  const s = str(value)
  const parsed = new Date(s)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`unparseable timestamp: ${JSON.stringify(value)}`)
  }
  return parsed.toISOString()
}

function toISODate(value: CellValue): string | null {
  if (value == null || value === '') return null
  if (isSheetsSerial(value)) return serialToISODate(value)
  const s = str(value)
  // A handful of legacy rows may carry the raw ISO-date STRING the off-by-one
  // bug produces (points/Code.gs:154-158) rather than a Sheets-converted
  // serial, if the column's cell format ever prevented auto-detection.
  // Preserved verbatim either way — never recomputed.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  throw new Error(`unparseable date: ${JSON.stringify(value)}`)
}

// ---------------------------------------------------------------------------
// points_monthly -> app.point_lots (is_legacy = true)
// ---------------------------------------------------------------------------

export interface LegacyPointLot {
  line_user_id: string
  period: string
  earned_points: number
  consumed_points: number
  /** = earned - consumed. Carried through so transformPointsMonthly can assert it against column E. */
  remaining_points: number
  status: 'active' | 'expired'
  expires_at: string | null
  earned_at: string
  source_waste_id: null
  is_legacy: true
}

export function transformPointsMonthly(
  rows: CellValue[][],
): { lots: LegacyPointLot[]; quarantined: QuarantinedRow[] } {
  if (rows.length === 0) return { lots: [], quarantined: [] }
  const idx = requireColumns(rows[0], ['user_id', 'month', 'earned', 'spent', 'balance', 'status'], 'points_monthly')

  const lots: LegacyPointLot[] = []
  const quarantined: QuarantinedRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const userId = str(row[idx.get('user_id')!])
    if (!userId) continue // trailing blank row

    try {
      const earned = num(row[idx.get('earned')!])
      const spent = num(row[idx.get('spent')!])
      const balance = num(row[idx.get('balance')!])
      const period = str(row[idx.get('month')!])
      const rawStatus = str(row[idx.get('status')!]).toLowerCase()

      // The one free integrity check the plan calls out: C - D must equal E.
      if (earned - spent !== balance) {
        quarantined.push({
          tab: 'points_monthly',
          rowIndex: i + 1,
          reason: `earned(${earned}) - spent(${spent}) = ${earned - spent}, but balance column says ${balance}`,
          raw: row,
        })
        continue
      }

      if (!/^\d{4}-\d{2}$/.test(period)) {
        quarantined.push({
          tab: 'points_monthly',
          rowIndex: i + 1,
          reason: `period "${period}" is not YYYY-MM`,
          raw: row,
        })
        continue
      }

      const status = rawStatus === 'expired' ? 'expired' : 'active'
      const expiresAtIdx = idx.get('expires_at')
      const expires_at = expiresAtIdx !== undefined ? toISODate(row[expiresAtIdx]) : null

      lots.push({
        line_user_id: userId,
        period,
        earned_points: earned,
        consumed_points: spent,
        remaining_points: balance,
        status,
        expires_at,
        // points_monthly carries no per-row earn timestamp — the first day of
        // the bucket's own month is the least-wrong stand-in, and only ever
        // feeds FIFO tie-breaking among a user's OTHER lots, never a
        // user-visible date.
        earned_at: new Date(`${period}-01T00:00:00.000Z`).toISOString(),
        source_waste_id: null,
        is_legacy: true,
      })
    } catch (err) {
      quarantined.push({
        tab: 'points_monthly',
        rowIndex: i + 1,
        reason: err instanceof Error ? err.message : String(err),
        raw: row,
      })
    }
  }

  return { lots, quarantined }
}

// ---------------------------------------------------------------------------
// points_transactions -> app.point_transactions (is_legacy = true, history only)
//
// NEVER feeds lot construction — lots come from points_monthly buckets alone.
// Deriving from both would double-count every earn (PHASE-0-FINDINGS.md).
// ---------------------------------------------------------------------------

export interface LegacyPointTransaction {
  tx_id: string
  line_user_id: string
  kind: 'earn' | 'spend'
  /** Spends are negative here — the legacy sheet stores a positive magnitude with type='spend'. */
  points_delta: number
  co2_kg: number
  weight_kg: number
  category: null
  idempotency_key: null
  is_legacy: true
  occurred_at: string
}

export function transformPointsTransactions(
  rows: CellValue[][],
): { transactions: LegacyPointTransaction[]; quarantined: QuarantinedRow[] } {
  if (rows.length === 0) return { transactions: [], quarantined: [] }
  const idx = requireColumns(
    rows[0],
    ['tx_id', 'user_id', 'type', 'points', 'co2', 'weight', 'timestamp'],
    'points_transactions',
  )

  const transactions: LegacyPointTransaction[] = []
  const quarantined: QuarantinedRow[] = []
  const seenTxIds = new Set<string>()

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const userId = str(row[idx.get('user_id')!])
    if (!userId) continue

    try {
      const txId = str(row[idx.get('tx_id')!])
      if (!txId) throw new Error('missing tx_id')
      if (seenTxIds.has(txId)) throw new Error(`duplicate tx_id ${txId}`)
      seenTxIds.add(txId)

      const rawType = str(row[idx.get('type')!]).toLowerCase()
      if (rawType !== 'earn' && rawType !== 'spend') {
        throw new Error(`unknown transaction type "${rawType}"`)
      }
      const kind = rawType as 'earn' | 'spend'
      const magnitude = num(row[idx.get('points')!])

      transactions.push({
        tx_id: txId,
        line_user_id: userId,
        kind,
        points_delta: kind === 'spend' ? -Math.abs(magnitude) : Math.abs(magnitude),
        co2_kg: num(row[idx.get('co2')!]),
        weight_kg: num(row[idx.get('weight')!]),
        category: null,
        idempotency_key: null,
        is_legacy: true,
        occurred_at: toISODateTime(row[idx.get('timestamp')!]),
      })
    } catch (err) {
      quarantined.push({
        tab: 'points_transactions',
        rowIndex: i + 1,
        reason: err instanceof Error ? err.message : String(err),
        raw: row,
      })
    }
  }

  return { transactions, quarantined }
}

// ---------------------------------------------------------------------------
// spend_details -> app.spend_details
// ---------------------------------------------------------------------------

export interface LegacySpendDetail {
  tx_id: string
  line_user_id: string
  category: string
  item_name: string
  quantity: number
  points: number
  status: 'บริจาคสำเร็จ' | 'รอใช้งานคูปอง' | 'ใช้คูปองแล้ว'
  occurred_at: string
}

const VALID_SPEND_STATUS = new Set(['บริจาคสำเร็จ', 'รอใช้งานคูปอง', 'ใช้คูปองแล้ว'])

export function transformSpendDetails(
  rows: CellValue[][],
): { details: LegacySpendDetail[]; quarantined: QuarantinedRow[] } {
  if (rows.length === 0) return { details: [], quarantined: [] }
  const idx = requireColumns(
    rows[0],
    ['tx_id', 'user_id', 'category', 'item_name', 'quantity', 'points', 'status', 'timestamp'],
    'spend_details',
  )

  const details: LegacySpendDetail[] = []
  const quarantined: QuarantinedRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const userId = str(row[idx.get('user_id')!])
    if (!userId) continue

    try {
      const status = str(row[idx.get('status')!])
      if (!VALID_SPEND_STATUS.has(status)) {
        throw new Error(`unknown status "${status}" — app.spend_details_status_check would reject this`)
      }

      details.push({
        tx_id: str(row[idx.get('tx_id')!]),
        line_user_id: userId,
        category: str(row[idx.get('category')!]) || 'reward',
        item_name: str(row[idx.get('item_name')!]),
        quantity: Math.max(1, Math.round(num(row[idx.get('quantity')!]) || 1)),
        points: num(row[idx.get('points')!]),
        status: status as LegacySpendDetail['status'],
        occurred_at: toISODateTime(row[idx.get('timestamp')!]),
      })
    } catch (err) {
      quarantined.push({
        tab: 'spend_details',
        rowIndex: i + 1,
        reason: err instanceof Error ? err.message : String(err),
        raw: row,
      })
    }
  }

  return { details, quarantined }
}

// ---------------------------------------------------------------------------
// points_account -> app.points_accounts
//
// total_points is NOT loaded anywhere — it's the spendable balance
// (syncAccount recomputed it from points_monthly.balance on every write), and
// the new schema derives that same number from point_lots
// (app.v_user_balances) rather than storing it. Loading it would give the
// migration two sources of truth for one balance; the reconciliation gate
// checks that the derived number equals this column instead of loading it.
// ---------------------------------------------------------------------------

export interface LegacyPointsAccount {
  line_user_id: string
  lifetime_earned: number
  lifetime_spent: number
  total_weight_kg: number
  total_co2_kg: number
  /** Preserved verbatim for the reconciliation gate — not trusted as input to tier_for_weight. */
  stored_tier: string
  /** The column this row's balance-reconciliation gate checks derived lots against. */
  stored_spendable: number
}

export function transformPointsAccount(
  rows: CellValue[][],
  lots: LegacyPointLot[],
  transactions: LegacyPointTransaction[],
): { accounts: LegacyPointsAccount[]; quarantined: QuarantinedRow[] } {
  if (rows.length === 0) return { accounts: [], quarantined: [] }
  // total_weight carries a trailing space in the real header — matched via
  // the trimmed index, same as every other column.
  const idx = requireColumns(
    rows[0],
    ['user_id', 'total_points', 'total_weight', 'total_co2', 'tier'],
    'points_account',
  )

  const earnedByUser = new Map<string, number>()
  for (const lot of lots) {
    earnedByUser.set(lot.line_user_id, (earnedByUser.get(lot.line_user_id) ?? 0) + lot.earned_points)
  }
  const spentByUser = new Map<string, number>()
  for (const lot of lots) {
    spentByUser.set(lot.line_user_id, (spentByUser.get(lot.line_user_id) ?? 0) + lot.consumed_points)
  }

  const accounts: LegacyPointsAccount[] = []
  const quarantined: QuarantinedRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const userId = str(row[idx.get('user_id')!])
    if (!userId) continue

    try {
      accounts.push({
        line_user_id: userId,
        lifetime_earned: earnedByUser.get(userId) ?? 0,
        lifetime_spent: spentByUser.get(userId) ?? 0,
        total_weight_kg: num(row[idx.get('total_weight')!]),
        total_co2_kg: num(row[idx.get('total_co2')!]),
        stored_tier: str(row[idx.get('tier')!]),
        stored_spendable: num(row[idx.get('total_points')!]),
      })
    } catch (err) {
      quarantined.push({
        tab: 'points_account',
        rowIndex: i + 1,
        reason: err instanceof Error ? err.message : String(err),
        raw: row,
      })
    }
  }

  return { accounts, quarantined }
}

export { toISODate, toISODateTime }
