import { NextRequest, NextResponse } from 'next/server'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { parseJsonBody, readIdempotencyKey } from '@/lib/schemas/common'
import { donatePointsSchema } from '@/lib/schemas/points'
import {
  getAccount,
  getCo2Collection,
  getSpendDetails,
  getTransactions,
} from '@/lib/supabase/reads'
import { spendPoints, WriteError } from '@/lib/supabase/writes'

// ─── Reads ─────────────────────────────────────────────────────────────────
// The spendable balance is DERIVED (app.v_user_balances), so get_account_fast
// and get_balance are the same single query and there is nothing for
// resync_balance to repair. get_account_fast used to read the public points
// spreadsheet directly to dodge an Apps Script cold start; there is no cold
// start to dodge any more.
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action  = searchParams.get('action')
    const user_id = searchParams.get('user_id')

    if (!action)  return NextResponse.json({ error: 'Missing action'  }, { status: 400 })
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    return await readFromSupabase(action, user_id)
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
// An allowlist rather than a denylist, so a new action is never public by
// default. It outlived the Apps Script ACTIONS map it was written to contain
// (google-apps-script/points/Code.gs:174-185) and still earns its place.
const FORWARDABLE_ACTIONS = new Set([
  'get_or_create_account', // lib/points-context.tsx:121
  'resync_balance',        // lib/points-context.tsx:134 — a no-op on Supabase
  'spend_points',          // lib/points-context.tsx:181
  'mark_spend_used',       // folded into use_coupon on the Supabase backend
])

/**
 * The write actions.
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
          // 200 with success:false — the client reads `data.success` and
          // shows `data.message`, so the status code is not the signal here.
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

    return await writeToSupabase(request, action, user_id)
  } catch (error) {
    console.error('[points] POST error:', error)
    return NextResponse.json({ error: 'Failed to write points data' }, { status: 500 })
  }
}
