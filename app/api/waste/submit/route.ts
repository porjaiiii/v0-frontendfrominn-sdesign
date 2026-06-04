import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw_noRdEQaGUqln9xbL6sZmuXi34kDXmgx9f8KfClvNcVBNBAiPYPSgpCSUkVaMhrWX/exec'
const CARBON_FACTORS = {
  plastic: 2.5,
  paper: 1.8,
  glass: 0.8,
  aluminum: 4.0,
  oil: 3.0,
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      user_id,
      waste_type,
      waste_subtype,
      weight_kg,
      image_url,
      notes,
    } = body

    console.log('[v0] Received waste submission:', { user_id, waste_type, waste_subtype, weight_kg })

    if (!user_id || !waste_type || !waste_subtype || !weight_kg) {
      console.log('[v0] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // คำนวณ carbon reduction
    const carbonFactor = CARBON_FACTORS[waste_type as keyof typeof CARBON_FACTORS] || 2.0
    const carbonReduction = weight_kg * carbonFactor
    const pointsEarned = Math.round(carbonReduction * 10)

    // บันทึก timestamp
    const timestamp = new Date().toISOString()

    // ส่งข้อมูลไปยัง Google Apps Script Webhook
    const payload = {
      action: 'submitWaste',
      type: 'insert',
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

    console.log('[v0] Sending to Google Apps Script...')
    
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
          error: 'Failed to save to Google Sheet',
          details: error.substring(0, 200),
          status: response.status,
        },
        { status: 500 }
      )
    }

    const result = await response.json()
    console.log('[v0] Data submitted successfully:', result)

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
    console.error('[v0] Error submitting waste record:', error)
    return NextResponse.json(
      { error: 'Failed to submit waste record' },
      { status: 500 }
    )
  }
}
