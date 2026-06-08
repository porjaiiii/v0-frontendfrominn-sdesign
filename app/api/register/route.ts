import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyLNxRM_3l2Fyd88xAiPNOVia0HY0OW_fVRIOBAFONA0KtGocRsmmLG66u8Vx5O5wY/exec'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[v0] === REGISTRATION REQUEST START ===')
    console.log('[v0] Raw body received:', JSON.stringify(body, null, 2))
    
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

    console.log('[v0] Parsed data - LINE ID:', lineUserId, 'Name:', fullName, 'Phone:', phoneNumber)

    // Validate required fields
    if (!lineUserId || !fullName || !phoneNumber || !gender || !ageRange || !pdpaConsent) {
      console.log('[v0] VALIDATION ERROR: Missing required fields')
      console.log('[v0] lineUserId:', !!lineUserId, 'fullName:', !!fullName, 'phoneNumber:', !!phoneNumber)
      console.log('[v0] gender:', !!gender, 'ageRange:', !!ageRange, 'pdpaConsent:', !!pdpaConsent)
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

    console.log('[v0] Payload to send:', JSON.stringify(payload, null, 2))
    console.log('[v0] Using Google Apps Script URL:', GOOGLE_APPS_SCRIPT_URL)
    console.log('[v0] Attempting to POST to Google Apps Script...')
    
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    console.log('[v0] Google Apps Script response status:', response.status, response.statusText)
    console.log('[v0] Response headers:', Object.fromEntries(response.headers.entries()))

    const responseText = await response.text()
    console.log('[v0] Response body (raw):', responseText.substring(0, 1000))

    if (!response.ok) {
      console.error('[v0] GOOGLE APPS SCRIPT ERROR:')
      console.error('[v0] Status:', response.status, response.statusText)
      console.error('[v0] Response:', responseText.substring(0, 500))
      return NextResponse.json(
        { 
          error: 'Failed to save registration to Google Sheet',
          details: responseText.substring(0, 200),
          status: response.status,
        },
        { status: 500 }
      )
    }

    console.log('[v0] SUCCESS! Registration data sent to Google Sheet')
    console.log('[v0] === REGISTRATION REQUEST END ===')

    return NextResponse.json({
      success: true,
      data: {
        lineUserId,
        fullName,
        registrationDate,
      },
    })
  } catch (error) {
    console.error('[v0] === ERROR IN REGISTRATION ===')
    console.error('[v0] Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('[v0] Error message:', error instanceof Error ? error.message : String(error))
    console.error('[v0] Full error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to submit registration',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
