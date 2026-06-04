import { NextRequest, NextResponse } from 'next/server'
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw3j0l0-1Mh4cRT1ZIeXS8U3mV5kQ-4FB7GBAZngjHA2ai9T_GI492-Kr6HXJlwZf_f/exec'

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
