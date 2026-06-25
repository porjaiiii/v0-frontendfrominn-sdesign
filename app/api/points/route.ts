import { NextRequest, NextResponse } from 'next/server'
import { POINTS_SCRIPT_URL } from '@/lib/points-config'

// ─── Fast balance read (bypasses Apps Script) ──────────────────────────────
// Reads the public points spreadsheet directly via the Sheets API. The balance
// shown on the rewards page comes from points_monthly (the spendable amount, =
// resync_balance), while weight/CO2/tier come from points_account.
const POINTS_SHEETS_ID = process.env.POINTS_SHEETS_ID
const SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY

function colIndex(headers: string[], name: string): number {
  const target = name.trim().toLowerCase()
  return headers.findIndex((h) => String(h ?? '').trim().toLowerCase() === target)
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

async function readTab(tab: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${POINTS_SHEETS_ID}/values/${encodeURIComponent(
    tab
  )}?key=${SHEETS_API_KEY}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Sheets ${tab} read failed: ${res.status}`)
  const json = await res.json()
  return (json.values ?? []) as string[][]
}

// Returns the account in the same shape get_or_create_account/resync produce,
// or null when the user has no account row yet (let GAS create it).
async function fetchAccountFast(userId: string) {
  const [accountRows, monthlyRows] = await Promise.all([
    readTab('points_account'),
    readTab('points_monthly'),
  ])

  if (accountRows.length <= 1) return null
  const ah = accountRows[0]
  const aId = colIndex(ah, 'user_id')
  const aWeight = colIndex(ah, 'total_weight')
  const aCo2 = colIndex(ah, 'total_co2')
  const aTier = colIndex(ah, 'tier')
  const aUpd = colIndex(ah, 'last_updated')
  const accRow = accountRows.slice(1).find((r) => String(r[aId] ?? '').trim() === userId)
  if (!accRow) return null

  // Spendable balance = sum of `balance` over the user's active monthly buckets,
  // which is what resync_balance computes from points_monthly.
  let spendable = 0
  if (monthlyRows.length > 1) {
    const mh = monthlyRows[0]
    const mId = colIndex(mh, 'user_id')
    const mBal = colIndex(mh, 'balance')
    const mStatus = colIndex(mh, 'status')
    for (const r of monthlyRows.slice(1)) {
      if (String(r[mId] ?? '').trim() !== userId) continue
      const status = mStatus >= 0 ? String(r[mStatus] ?? '').trim().toLowerCase() : 'active'
      if (status && status !== 'active') continue
      spendable += num(r[mBal])
    }
  }

  return {
    user_id: userId,
    total_points: Math.round(spendable),                       // points are whole numbers
    total_weight: Math.round(num(accRow[aWeight]) * 100) / 100, // 2-decimal metric
    total_co2: Math.round(num(accRow[aCo2]) * 100) / 100,       // 2-decimal metric
    tier: String(accRow[aTier] ?? '').trim(),
    last_updated: aUpd >= 0 ? String(accRow[aUpd] ?? '').trim() : undefined,
  }
}

// GET /api/points?action=get_account_fast&user_id=xxx  (Sheets API, no GAS)
// GET /api/points?action=get_balance&user_id=xxx       (Apps Script)
// GET /api/points?action=get_transactions&user_id=xxx  (Apps Script)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action  = searchParams.get('action')
    const user_id = searchParams.get('user_id')

    if (!action)  return NextResponse.json({ error: 'Missing action'  }, { status: 400 })
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    // Fast path: read the balance straight from the public points sheet.
    if (action === 'get_account_fast') {
      if (!POINTS_SHEETS_ID || !SHEETS_API_KEY) {
        return NextResponse.json({ success: false, error: 'Points sheet not configured' })
      }
      try {
        const account = await fetchAccountFast(user_id)
        if (account) return NextResponse.json({ success: true, account })
        return NextResponse.json({ success: false, notFound: true })
      } catch (e) {
        console.error('[points] get_account_fast error:', e)
        return NextResponse.json({ success: false, error: 'Fast balance read failed' })
      }
    }

    const url = `${POINTS_SCRIPT_URL}?action=${encodeURIComponent(action)}&user_id=${encodeURIComponent(user_id)}`
    const response = await fetch(url)

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error: 'Points script error', details: error.substring(0, 200) }, { status: 500 })
    }

    const result = await response.json()
    return NextResponse.json(result)

  } catch (error) {
    console.error('[points] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch points data' }, { status: 500 })
  }
}

// POST /api/points
// body: { action, user_id, ...extra params }
//
// Supported actions:
//   get_or_create_account  — { user_id }
//   earn_points            — { user_id, points, co2?, weight?, waste_type? }
//   spend_points           — { user_id, points }
//   resync_balance         — { user_id }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, user_id } = body

    if (!action)  return NextResponse.json({ error: 'Missing action'  }, { status: 400 })
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    console.log('[points] action:', action, '| user_id:', user_id)

    const response = await fetch(POINTS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    console.log('[points] script response status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('[points] script error:', error.substring(0, 500))
      return NextResponse.json(
        { error: 'Points script error', details: error.substring(0, 200) },
        { status: 500 }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)

  } catch (error) {
    console.error('[points] POST error:', error)
    return NextResponse.json({ error: 'Failed to process points action' }, { status: 500 })
  }
}
