// Which spreadsheet backs which env var, and which tabs each carries. One
// place to add a source once its ID is known — export.ts and verify.ts both
// read this list rather than hardcoding tab names twice.
//
// Only `points` is runnable today. `registration` is listed so the shape of
// the eventual full export is visible in one place, but export.ts refuses to
// run it until REGISTRATION_SHEETS_ID actually exists — GAS #1
// (line-oa/Code.gs) is a BOUND script (SpreadsheetApp.getActiveSpreadsheet()),
// so its id is not recoverable from source; it has to come from whoever has
// the sheet open.

export interface DataSource {
  key: 'points' | 'registration'
  /** Human label for logs and the export manifest. */
  label: string
  envVar: string
  tabs: string[]
}

export const DATA_SOURCES: DataSource[] = [
  {
    key: 'points',
    label: 'GAS #2 — points ledger',
    envVar: 'POINTS_SPREADSHEET_ID',
    tabs: ['points_account', 'points_monthly', 'co2_collection', 'points_transactions', 'spend_details'],
  },
  {
    key: 'registration',
    label: 'GAS #1 — registration, waste, coupons, admin keys',
    envVar: 'REGISTRATION_SHEETS_ID',
    // Tab names per PHASE-0-FINDINGS.md's per-tab column map. Not yet verified
    // against a real header row — export.ts will assert the fetched header
    // matches this file's transform expectations before trusting any of it.
    tabs: ['submission', 'coupons', 'Registration', 'AdminKeys'],
  },
]

export function resolveSpreadsheetId(source: DataSource): string | null {
  return process.env[source.envVar]?.trim() || null
}
