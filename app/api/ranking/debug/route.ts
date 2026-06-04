import { NextResponse } from 'next/server'

// Debug endpoint — visit /api/ranking/debug to inspect the raw data from the 'point' sheet.
// Remove this file before going to production.
export async function GET() {
  const sheetId = process.env.GOOGLE_SHEETS_ID
  const apiKey  = process.env.GOOGLE_SHEETS_API_KEY

  if (!sheetId || !apiKey) {
    return NextResponse.json({ error: 'GOOGLE_SHEETS_ID or GOOGLE_SHEETS_API_KEY not set' }, { status: 500 })
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/point?key=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' })

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: `Sheets API error: ${res.status}`, body }, { status: 500 })
  }

  const json = await res.json()
  const rows: string[][] = json.values ?? []
  const headers = rows[0] ?? []

  const normalize = (h: string) =>
    (h ?? '').toLowerCase().trim().replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x2050)
    )
  const findIdx = (terms: string[]) =>
    headers.findIndex(h => terms.some(t => normalize(h).includes(t)))

  return NextResponse.json({
    totalRows: rows.length,
    headers,
    detectedIndices: {
      lineUserId: findIdx(['line user id', 'lineuserid', 'line_user_id']),
      points:     findIdx(['total points', 'totalpoints', 'points']),
      co2:        findIdx(['kgco2e', 'kgco2', 'co2e', 'co2', 'carbon']),
    },
    firstThreeDataRows: rows.slice(1, 4),
  })
}
