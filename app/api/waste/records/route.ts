import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwmfv652zC-yp978r_jTAA034BD3gkOsQ3L6WH_536euEts50Ie3e1E73OEydAOO4_r/exec'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id parameter is required' },
        { status: 400 }
      )
    }

    console.log('[v0] Fetching waste records for user_id:', userId)

    // เรียก Google Apps Script เพื่อดึงข้อมูล
    const payload = {
      action: 'getRecords',
      user_id: userId,
    }
    console.log('[v0] Sending payload to Apps Script:', payload)
    
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    console.log('[v0] Apps Script response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[v0] Apps Script error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch waste records' },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[v0] Apps Script returned data:', data)

    return NextResponse.json({
      records: data.records || [],
      stats: data.stats || null,
    })
  } catch (error) {
    console.error('[v0] Error fetching waste records:', error)
    return NextResponse.json(
      { error: 'Failed to fetch waste records' },
      { status: 500 }
    )
  }
}
