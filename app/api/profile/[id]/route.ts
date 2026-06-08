import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby0zXLUHa6E5kez5FomZ_ImU0mzNpCe6F88lChLGYZAOYSs7WEuKQ5KyRyvm9y3m2kX/exec'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lineId } = await context.params

    if (!lineId) {
      return NextResponse.json(
        { error: 'LINE ID is required' },
        { status: 400 }
      )
    }

    console.log('[v0] API: Fetching profile for LINE ID:', lineId)

    // ส่ง request ไปหา Google Apps Script เพื่อดึงข้อมูลจาก Registration sheet
    const payload = {
      action: 'getUser',
      lineUserId: lineId,
    }

    console.log('[v0] Sending request to Google Apps Script:', GOOGLE_APPS_SCRIPT_URL)
    
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    console.log('[v0] Google Apps Script response status:', response.status)

    if (!response.ok) {
      console.error('[v0] Failed to fetch from Google Apps Script:', response.statusText)
      return NextResponse.json(
        { error: 'Failed to fetch from Google Apps Script' },
        { status: 500 }
      )
    }

    const responseText = await response.text()
    console.log('[v0] Response body:', responseText.substring(0, 500))

    let result
    try {
      result = JSON.parse(responseText)
    } catch (e) {
      console.error('[v0] Failed to parse JSON response:', responseText)
      return NextResponse.json(
        { error: 'Invalid response format' },
        { status: 500 }
      )
    }

    if (result.status === 'success' && result.data) {
      console.log('[v0] Found user:', result.data.fullName)
      return NextResponse.json(result.data)
    } else if (result.status === 'error') {
      console.log('[v0] User not found:', result.message)
      return NextResponse.json(
        { error: result.message || 'User not found' },
        { status: 404 }
      )
    } else {
      return NextResponse.json(
        { error: 'Unexpected response format' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[v0] API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}
