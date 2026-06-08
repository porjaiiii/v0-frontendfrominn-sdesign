import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_REGISTER_URL || 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/usercontent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      lineUserId,
      userId,
      pdpaConsent,
      fullName,
      phoneNumber,
      gender,
      ageRange,
      userType,
      subdistrict,
      occupation,
      registrationDate,
    } = body

    console.log('[v0] Received registration data:', { lineUserId, fullName, phoneNumber })

    // Validate required fields
    if (!lineUserId || !fullName || !phoneNumber || !gender || !ageRange || !pdpaConsent) {
      console.log('[v0] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // ส่งข้อมูลไปยัง Google Apps Script Webhook
    const payload = {
      action: 'registerUser',
      type: 'insert',
      status: 'done',
      lineUserId,
      userId: userId || '',
      pdpaConsent,
      fullName,
      phoneNumber,
      gender,
      ageRange,
      userType: userType || '',
      subdistrict: subdistrict || '',
      occupation: occupation || '',
      registrationDate: registrationDate || new Date().toLocaleDateString('th-TH'),
      timestamp: new Date().toISOString(),
    }

    console.log('[v0] Sending registration to Google Apps Script...')
    
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
          error: 'Failed to save registration to Google Sheet',
          details: error.substring(0, 200),
          status: response.status,
        },
        { status: 500 }
      )
    }

    const result = await response.json()
    console.log('[v0] Registration submitted successfully:', result)

    return NextResponse.json({
      success: true,
      data: {
        lineUserId,
        fullName,
        registrationDate,
      },
    })
  } catch (error) {
    console.error('[v0] Error submitting registration:', error)
    return NextResponse.json(
      { error: 'Failed to submit registration' },
      { status: 500 }
    )
  }
}
