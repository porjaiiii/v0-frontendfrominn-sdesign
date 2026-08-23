// Thin wrapper around the Sheets API v4 REST endpoint — read-only, and
// deliberately so: this script has no path to writing to a Sheet at all, on
// purpose. The migration's export step must never be able to touch the source
// of truth it's reading from.
//
// Per the plan: `values.batchGet` with UNFORMATTED_VALUE, never the CSV export
// path (CSV mangles Thai quoting and drops leading 0/+ on phone numbers, and
// reformats dates by locale). A second FORMATTED_VALUE pass is fetched
// alongside it so transform.ts's quarantine logic can flag any cell where the
// two disagree in a way UNFORMATTED_VALUE's raw serial doesn't explain.

export interface SheetTab {
  title: string
  rowCount: number
  columnCount: number
}

export interface SheetMetadata {
  spreadsheetId: string
  title: string
  /** IANA zone, e.g. "Asia/Bangkok" — required to interpret any date serial. */
  timeZone: string
  tabs: SheetTab[]
}

export type CellValue = string | number | boolean | null

export interface TabValues {
  title: string
  /** [0] is the header row, verbatim — including any stray whitespace. */
  rows: CellValue[][]
}

function apiKey(): string {
  const key = process.env.GOOGLE_SHEETS_API_KEY
  if (!key) throw new Error('GOOGLE_SHEETS_API_KEY is not set')
  return key
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Sheets API ${res.status} for ${url}: ${body.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

/** Metadata only — tab names and dimensions, no cell data. Always safe to call. */
export async function getSpreadsheetMetadata(spreadsheetId: string): Promise<SheetMetadata> {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `?key=${apiKey()}&fields=properties.title,properties.timeZone,sheets.properties`

  const data = await getJson<{
    properties: { title: string; timeZone: string }
    sheets: { properties: { title: string; gridProperties?: { rowCount?: number; columnCount?: number } } }[]
  }>(url)

  return {
    spreadsheetId,
    title: data.properties.title,
    timeZone: data.properties.timeZone,
    tabs: data.sheets.map((s) => ({
      title: s.properties.title,
      rowCount: s.properties.gridProperties?.rowCount ?? 0,
      columnCount: s.properties.gridProperties?.columnCount ?? 0,
    })),
  }
}

/**
 * Every row of every named tab, in ONE batch request per render option — not
 * one request per tab, which would be the same one-request-per-item habit that
 * got the old Drive thumbnails rate-limited (see Phase 6's PHASE-0-FINDINGS
 * notes). Two render options per tab (UNFORMATTED_VALUE + FORMATTED_VALUE),
 * so two batch calls total for the whole spreadsheet regardless of tab count.
 */
export async function getAllTabValues(
  spreadsheetId: string,
  tabTitles: string[],
): Promise<{ unformatted: TabValues[]; formatted: TabValues[] }> {
  const ranges = tabTitles.map((t) => `ranges=${encodeURIComponent(t)}`).join('&')

  const fetchBatch = async (renderOption: 'UNFORMATTED_VALUE' | 'FORMATTED_VALUE') => {
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet` +
      `?key=${apiKey()}&${ranges}&valueRenderOption=${renderOption}&dateTimeRenderOption=SERIAL_NUMBER`

    const data = await getJson<{ valueRanges: { range: string; values?: CellValue[][] }[] }>(url)

    return data.valueRanges.map((vr, i) => ({
      title: tabTitles[i],
      rows: vr.values ?? [],
    }))
  }

  const [unformatted, formatted] = await Promise.all([
    fetchBatch('UNFORMATTED_VALUE'),
    fetchBatch('FORMATTED_VALUE'),
  ])

  return { unformatted, formatted }
}
