import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxwo5pS6K0UxDFvXqO1xY0cwPXa-w5QX28IuekaweLC8-0k6mbadt1yvGdRNhNLKGuL/exec'
const CARBON_FACTORS = {
  plastic: 2.5,
  paper: 1.8,
  glass: 0.8,
  aluminum: 4.0,
  oil: 3.0,
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

    // คำนวณ carbon reduction ใหม่
    const carbonFactor = CARBON_FACTORS[waste_type as keyof typeof CARBON_FACTORS] || 2.0
    const carbonReduction = weight_kg * carbonFactor
    const pointsEarned = Math.round(carbonReduction * 10)

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

    return NextResponse.json({
      success: true,
      data: {
        timestamp,
        user_id,
        waste_type,
        weight_kg,
        carbon_reduction: carbonReduction,
        points_earned: pointsEarned,
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
