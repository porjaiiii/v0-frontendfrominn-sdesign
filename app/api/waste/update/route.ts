import { NextRequest, NextResponse } from 'next/server'
import { POINTS_SCRIPT_URL } from '@/lib/points-config'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { backendFor, isMaintenance, MAINTENANCE_MESSAGE } from '@/lib/backend-flags'
import { parseJsonBody, readIdempotencyKey } from '@/lib/schemas/common'
import { updateWasteSchema } from '@/lib/schemas/waste'
import { confirmWaste, WriteError } from '@/lib/supabase/writes'
import { carbonFactorFor, pointsPerKgFor } from '@/lib/rates'

const GOOGLE_APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_GAS_URL1 ?? ''

// GAS branch only, via lib/rates.ts — the Supabase branch reads the rates from
// app.waste_types, the single LIVE copy of the same numbers.

/**
 * Supabase path — one transaction where the GAS path below is three sequential
 * HTTP calls with a try/catch marked "non-fatal".
 *
 * That comment is the bug: when `earn_points` fails the record is already
 * permanently `done` with zero points, and when the user retries it is awarded
 * a SECOND time. app.confirm_waste does the record update, the point lot, the
 * transaction, the ledger entry and the account aggregates atomically, and
 * awards exactly once no matter how many times it is called.
 */
async function respondFromSupabase(request: NextRequest) {
  if (isMaintenance()) {
    return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 })
  }

  const identity = await getLineIdentity(request)
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJsonBody(request, updateWasteSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    const result = await confirmWaste(
      identity.lineUserId,
      parsed.data,
      readIdempotencyKey(request),
    )

    return NextResponse.json({
      success: true,
      data: {
        id: result.record.id,
        timestamp: result.record.timestamp,
        user_id: result.record.user_id,
        waste_type: result.record.waste_type,
        weight_kg: result.record.weight_kg,
        carbon_reduction: result.record.carbon_reduction,
        points_earned: result.record.points_earned,
        // Same field name the client already reads. It now means "this call
        // awarded the points", so a replay reports false — which is the truth,
        // not a failure.
        points_awarded: result.pointsAwarded,
        already_confirmed: result.alreadyConfirmed,
        tx_id: result.txId,
      },
    })
  } catch (error) {
    if (error instanceof WriteError) {
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการบันทึกขยะกรุณาลองใหม่', details: error.message },
        { status: error.status },
      )
    }
    console.error('[waste/update] supabase write failed:', error)
    return NextResponse.json(
      {
        error: 'เกิดข้อผิดพลาดในการบันทึกขยะกรุณาลองใหม่',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  if (backendFor('wasteUpdate') === 'supabase') {
    return respondFromSupabase(request)
  }

  try {
    const body = await request.json()
    const {
      timestamp,
      user_id,
      waste_type,
      waste_subtype,
      weight_kg,
      image_url,
      notes,
      points_earned: pointsEarnedFromClient,
    } = body

    console.log('[v0] Received waste update:', { timestamp, user_id, waste_type, weight_kg })

    if (!timestamp || !user_id || !waste_type || !waste_subtype || !weight_kg) {
      console.log('[v0] Missing required fields for update')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // คำนวณ carbon reduction และแต้มแยกกัน
    const carbonFactor = carbonFactorFor(waste_type)
    const carbonReduction = weight_kg * carbonFactor
    const pointsRate = pointsPerKgFor(waste_type)
    const pointsEarned = typeof pointsEarnedFromClient === 'number' 
      ? pointsEarnedFromClient 
      : Math.round(weight_kg * pointsRate)

    // ส่งข้อมูลไปยัง Google Apps Script Webhook
    const payload = {
      action: 'updateWaste',
      type: 'update',
      status: 'done',
      timestamp,
      user_id,
      waste_type,
      waste_subtype,
      weight_kg,
      image_url: image_url || '',
      carbon_reduction: carbonReduction,
      points_earned: pointsEarned,
      notes: notes || ''
    }

    console.log('[v0] Sending update to Google Apps Script...')
    
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    console.log('[v0] Google Apps Script response status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('[v0] Google Apps Script error:', {
        status: response.status,
        statusText: response.statusText,
        error: error.substring(0, 500)
      })
      return NextResponse.json(
        { 
          error: 'เกิดข้อผิดพลาดในการบันทึกขยะกรุณาลองใหม่',
          details: error.substring(0, 200),
          status: response.status,
        },
        { status: 500 }
      )
    }

    const result = await response.json()
    console.log('[v0] Data updated successfully:', result)

    // Award points + carbon to the user's points account (separate points sheet).
    // The waste record is now "done", so this is the moment the user earns.
    // Non-fatal: a failure here must NOT break the waste-sheet update above.
    let pointsAwarded = false
    try {
      // 1) Make sure the points account row exists, otherwise the script's
      //    syncAccount() has no row to write the new total back to.
      await fetch(POINTS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_or_create_account', user_id }),
      })

      // 2) Earn the points + carbon (writes points_monthly, co2_collection,
      //    points_transactions, then syncs points_account).
      const earnRes = await fetch(POINTS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'earn_points',
          user_id,
          points: pointsEarned,
          co2: carbonReduction,
          weight: weight_kg,
          waste_type,
        }),
      })
      const earnResult = await earnRes.json()
      pointsAwarded = earnResult?.success === true
      console.log('[v0] Points earn result:', earnResult)
    } catch (err) {
      console.error('[v0] Failed to award points (waste update still saved):', err)
    }

    return NextResponse.json({
      success: true,
      data: {
        timestamp,
        user_id,
        waste_type,
        weight_kg,
        carbon_reduction: carbonReduction,
        points_earned: pointsEarned,
        points_awarded: pointsAwarded,
      },
    })
  } catch (error) {
    console.error('[v0] Error updating waste record:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกขยะกรุณาลองใหม่' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Redirect POST to PUT
  return PUT(request)
}
