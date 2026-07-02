import { NextRequest, NextResponse } from 'next/server'
import { POINTS_SCRIPT_URL } from '@/lib/points-config'

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzti99z__Gstc8IZZIbe8_hdjG9x4IHRh8UPaqc9nUx2j2-7WWCd-WqGy29zpkRGjTF/exec'
const POINTS_PER_KG = {
  plastic: 6,
  paper: 4,
  glass: 4,
  aluminum: 25,
  oil: 3,
}

export async function PUT(request: NextRequest) {
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
    } = body

    console.log('[v0] Received waste update:', { timestamp, user_id, waste_type, weight_kg })

    if (!timestamp || !user_id || !waste_type || !waste_subtype || !weight_kg) {
      console.log('[v0] Missing required fields for update')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // คำนวณแต้มและ carbon reduction ใหม่
    const pointsRate = POINTS_PER_KG[waste_type as keyof typeof POINTS_PER_KG] || 3
    const pointsEarned = Math.round(weight_kg * pointsRate)
    const carbonReduction = weight_kg

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
          error: 'Failed to update in Google Sheet',
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
      { error: 'Failed to update waste record' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Redirect POST to PUT
  return PUT(request)
}
