import { NextRequest, NextResponse } from 'next/server'
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxk3-Y2nHV2k44QYDYx9xqCTGDm1VGpWZtxOwRPOoqqsvIETWh_q7kEmKHm0w1s0nM_/exec'

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

    // เรียก Google Apps Script เพื่อดึงข้อมูล
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getRecords',
        user_id: userId,
        type: 'query',
      }),
    })

    if (!response.ok) {
      console.error('[v0] Apps Script error:', response.statusText)
      return NextResponse.json(
        { error: 'Failed to fetch waste records' },
        { status: response.status }
      )
    }

    const data = await response.json()

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
