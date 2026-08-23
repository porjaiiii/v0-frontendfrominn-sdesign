import { NextRequest, NextResponse } from 'next/server'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { backendFor } from '@/lib/backend-flags'
import { POINTS_SCRIPT_URL } from '@/lib/points-config'
import { parseJsonBody, readIdempotencyKey } from '@/lib/schemas/common'
import { donatePointsSchema } from '@/lib/schemas/points'
import {
  getAccount,
  getCo2Collection,
  getSpendDetails,
  getTransactions,
} from '@/lib/supabase/reads'
import { spendPoints, WriteError } from '@/lib/supabase/writes'

// ─── Fast balance read (bypasses Apps Script) ──────────────────────────────
// Reads the public points spreadsheet directly via the Sheets API. The balance
// shown on the rewards page comes from points_monthly (the spendable amount, =
// resync_balance), while weight/CO2/tier come from points_account.
const POINTS_SPREADSHEET_ID = process.env.POINTS_SPREADSHEET_ID
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
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${POINTS_SPREADSHEET_ID}/values/${encodeURIComponent(
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

// ─── Supabase read paths ───────────────────────────────────────────────────
// On this backend the spendable balance is DERIVED (app.v_user_balances), so
// get_account_fast and get_balance are the same single query and there is
// nothing for resync_balance to repair.
async function readFromSupabase(action: string, userId: string) {
  switch (action) {
    case 'get_account_fast':
    case 'get_balance': {
      const account = await getAccount(userId)
      if (!account) {
        return action === 'get_account_fast'
          ? NextResponse.json({ success: false, notFound: true })
          : NextResponse.json({ success: false, message: 'Account not found' })
      }
      return NextResponse.json({ success: true, account })
    }

    case 'get_transactions': {
      const transactions = await getTransactions(userId)
      return NextResponse.json({ success: true, transactions, total: transactions.length })
    }

    case 'get_spend_details': {
      const details = await getSpendDetails(userId)
      return NextResponse.json({ success: true, details, total: details.length })
    }

    case 'get_co2_collection': {
      const collection = await getCo2Collection(userId)
      return NextResponse.json({ success: true, collection, total: collection.length })
    }

    default:
      return NextResponse.json({ success: false, message: `Unknown action: ${action}` })
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

    if (backendFor('points') === 'supabase') {
      return await readFromSupabase(action, user_id)
    }

    // Fast path: read the balance straight from the public points sheet.
    if (action === 'get_account_fast') {
      if (!POINTS_SPREADSHEET_ID || !SHEETS_API_KEY) {
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
// This route used to forward ANY body to Apps Script verbatim, which made
// `{action:'earn_points', points:999999}` a working request from anywhere on the
// internet. Phase 4 closes that: earning is now a side effect of
// app.confirm_waste inside a transaction (supabase/migrations/0004_rpc_waste.sql)
// and is not reachable as a public action on either backend.
//
// An allowlist rather than a denylist — the GAS ACTIONS map
// (google-apps-script/points/Code.gs:174-185) grows independently of this file,
// and a new privileged action must not become public by default.
const FORWARDABLE_ACTIONS = new Set([
  'get_or_create_account', // lib/points-context.tsx:121
  'resync_balance',        // lib/points-context.tsx:134 — a no-op on Supabase
  'spend_points',          // lib/points-context.tsx:181
  'mark_spend_used',       // folded into use_coupon on the Supabase backend
])

/**
 * Supabase branch for the write actions.
 *
 * `get_or_create_account` and `resync_balance` are both no-ops here: there is no
 * account row to create before points exist, and the balance is derived by
 * app.v_user_balances rather than stored, so there is nothing to resync. Both
 * answer with the current account so lib/points-context keeps working unchanged.
 *
 * `mark_spend_used` is likewise a no-op — app.use_coupon flips spend_details in
 * the same transaction that consumes the coupon.
 */
async function writeToSupabase(request: NextRequest, action: string, userId: string) {
  switch (action) {
    case 'get_or_create_account':
    case 'resync_balance': {
      const account = await getAccount(userId)
      if (!account) {
        return NextResponse.json({ success: false, message: 'Account not found' })
      }
      return NextResponse.json({
        success: true,
        account,
        total_points: account.total_points,
      })
    }

    case 'mark_spend_used':
      return NextResponse.json({ success: true, rows_updated: 0, noop: true })

    case 'spend_points': {
      const identity = await getLineIdentity(request)
      if (!identity) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const parsed = await parseJsonBody(request, donatePointsSchema)
      if (!parsed.ok) {
        return NextResponse.json(parsed.body, { status: parsed.status })
      }

      // Only donations reach this path. Rewards go through
      // /api/coupons/redeem, which prices from the catalog and mints in the
      // same transaction — spending here and minting there is precisely the
      // split that let checkout take points and hand back nothing.
      try {
        const result = await spendPoints(
          identity.lineUserId,
          parsed.data,
          'donate',
          readIdempotencyKey(request),
        )
        return NextResponse.json({
          success: true,
          message: 'Points spent',
          tx_id: result.txId,
          points_spent: result.pointsSpent,
          remaining_balance: result.remainingBalance,
        })
      } catch (error) {
        if (error instanceof WriteError) {
          // 200 with success:false, matching what GAS returned — the client
          // reads `data.success` and shows `data.message`.
          return NextResponse.json({
            success: false,
            message: error.code === 'DW001' ? 'คะแนนของคุณไม่เพียงพอ' : error.message,
          })
        }
        throw error
      }
    }

    default:
      return NextResponse.json({ success: false, message: `Unknown action: ${action}` })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.clone().json()
    const { action, user_id } = body

    if (!action)  return NextResponse.json({ error: 'Missing action'  }, { status: 400 })
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    if (!FORWARDABLE_ACTIONS.has(action)) {
      console.warn('[points] rejected non-forwardable action:', action)
      return NextResponse.json(
        {
          error: `Action not available: ${action}`,
          details:
            action === 'earn_points'
              ? 'Points are awarded by confirming a waste record, not by calling this endpoint.'
              : undefined,
        },
        { status: 403 },
      )
    }

    if (backendFor('points') === 'supabase') {
      return await writeToSupabase(request, action, user_id)
    }

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
