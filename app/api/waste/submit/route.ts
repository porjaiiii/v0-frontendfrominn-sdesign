import { NextRequest, NextResponse } from 'next/server'

const SHEET_ID = '1SK_Nat8jb3iQWt-Gs_YUimycxMTcubV5ViD_QtqkO78'
const SHEET_NAME = 'submissions'

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

    // ส่งข้อมูลไปยัง Google Sheet ผ่าน Append API
    const range = `${SHEET_NAME}!A:J`
    const values = [
      [timestamp, user_id, waste_type, waste_subtype, weight_kg, image_url || '', carbonReduction, pointsEarned, 'pending', notes || '']
    ]

    const apiKey = process.env.GCP_API_KEY
    console.log('[v0] API Key exists:', !!apiKey)
    console.log('[v0] Sheet ID:', SHEET_ID)
    
    if (!apiKey) {
      console.error('[v0] GCP_API_KEY not configured')
      return NextResponse.json(
        { error: 'Google API key not configured' },
        { status: 500 }
      )
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&key=${apiKey}`
    console.log('[v0] Calling Google Sheets API...')
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    })

    console.log('[v0] Google Sheets response status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('[v0] Google Sheets API error:', error)
      throw new Error(`Google Sheets API error: ${response.statusText}`)
    }

    console.log('[v0] Data submitted successfully')

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
