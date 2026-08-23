// Google Sheets date-serial handling, for the migration only.
//
// Fetching with `valueRenderOption=UNFORMATTED_VALUE` (as export.ts does, per
// the plan — CSV export mangles Thai quoting and phone-number leading zeros)
// returns two different shapes for what look like the same kind of column, and
// getting them backwards corrupts every timestamp in the ledger:
//
//   1. A genuine Sheets DATE SERIAL — a plain number. Whole part = calendar
//      day count since 1899-12-30, fractional part = time of day. This is what
//      you get when a script writes a real `Date` object, or a string Sheets'
//      own auto-detection recognises as a date/datetime.
//
//      Confirmed live: points_monthly.expires_at (from GAS's
//      getExpiresAt(), points/Code.gs:154 — an ISO date STRING that Sheets
//      auto-converts on write) and points_transactions.timestamp /
//      spend_details.timestamp (from now_(), points/Code.gs:143-145 — a naive
//      'yyyy-MM-dd HH:mm:ss' Asia/Bangkok string, also auto-converted).
//
//      Critically, a serial carries NO timezone — it is the spreadsheet's own
//      wall-clock digits, encoded as a day-count. Decoding it back to Y-M-D
//      H:M:S recovers those SAME digits; only converting to a true UTC instant
//      (for a `timestamptz` column) requires knowing the spreadsheet's
//      timezone and subtracting the offset — confirmed live via the Sheets API
//      (`spreadsheet.properties.timeZone`) as "Asia/Bangkok", fixed UTC+7, no
//      DST.
//
//   2. A literal ISO-8601 STRING, already carrying its own 'Z'/offset. Confirmed
//      live: points_account.last_updated, written via
//      `.setValue(new Date().toISOString())` (points/Code.gs:274) — a format
//      Sheets' auto-detection does NOT recognise, so it's stored as plain text
//      and comes back unchanged. This needs no conversion at all — `new
//      Date(value)` is exact.
//
// This is exactly the seam PHASE-0-FINDINGS.md flags as the off-by-one bug:
// getExpiresAt builds a LOCAL-midnight Date and calls .toISOString(), so the
// Bangkok calendar date the script intended and the string it produces differ
// by one day. Decoding the resulting serial with this module recovers what the
// SHEET actually shows (the off-by-one, preserved) — which is the "lossless"
// requirement, not what the code's original intent was.

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

/** Epoch for reading a serial's WALL-CLOCK digits — no timezone applied yet. */
const SHEETS_EPOCH_NAIVE_UTC_MS = Date.UTC(1899, 11, 30, 0, 0, 0)

const MS_PER_DAY = 86_400_000

/**
 * Serial → the spreadsheet's own wall-clock digits (Y-M-D H:M:S), packaged as
 * a Date whose UTC getters read out those exact digits. This is NOT a real UTC
 * instant — treat it as a digit container, not a point in time, until you've
 * decided what to do with the timezone.
 */
function serialToNaiveWallClock(serial: number): Date {
  return new Date(SHEETS_EPOCH_NAIVE_UTC_MS + Math.round(serial * MS_PER_DAY))
}

/**
 * `YYYY-MM-DD` — the calendar date the cell shows, exactly, with no timezone
 * math (a date-only cell has no time-of-day component to get wrong).
 */
export function serialToISODate(serial: number): string {
  return serialToNaiveWallClock(serial).toISOString().slice(0, 10)
}

/**
 * The true UTC instant a Bangkok-local serial represents — for loading into a
 * `timestamptz` column. Subtracts the fixed +7:00 offset from the wall-clock
 * digits.
 */
export function serialToUtcInstant(serial: number): Date {
  return new Date(serialToNaiveWallClock(serial).getTime() - BANGKOK_OFFSET_MS)
}

export function serialToISODateTime(serial: number): string {
  return serialToUtcInstant(serial).toISOString()
}

/** Inverse of serialToUtcInstant — for tests and for round-tripping verbatim. */
export function utcInstantToSerial(date: Date): number {
  return (date.getTime() + BANGKOK_OFFSET_MS - SHEETS_EPOCH_NAIVE_UTC_MS) / MS_PER_DAY
}

/**
 * A cell from `values.get` under UNFORMATTED_VALUE is `number | string | boolean`.
 * A genuine Sheets serial always lands here as `number` — a string means the
 * cell is literal text (already-ISO, or something Sheets never auto-detected),
 * which the caller should parse with `new Date(value)` instead of this module.
 */
export function isSheetsSerial(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
