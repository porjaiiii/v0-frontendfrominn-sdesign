import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzJnOKocFO6Tyqsy7NUn060BtFr4oAtE4jaHbcrsMcEozzJLl0JcXvY4VAxg-XvkGu2/exec'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      lineUserId,
      userId,
      pdpaConsent,
      fullName,
      nickname,
      phoneNumber,
      address,
      gender,
      ageRange,
      userType,
      subdistrict,
      occupation,
    } = body

    if (!lineUserId || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const payload = {
      action: 'updateUser',
      lineUserId,
      userId: userId || '',
      pdpaConsent,
      fullName,
      nickname: nickname || '',
      phoneNumber,
      address: address || '',
      gender,
      ageRange,
      userType: userType || '',
      subdistrict: subdistrict || '',
      occupation: occupation || '',
      timestamp: new Date().toISOString(),
    }

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to update user in Google Sheet', details: responseText.substring(0, 200) },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: { lineUserId, fullName } })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update user', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      lineUserId,
      userId,
      pdpaConsent,
      fullName,
      nickname,
      phoneNumber,
      address,
      gender,
      ageRange,
      userType,
      subdistrict,
      occupation,
      registrationDate,
    } = body

    // Validate required fields (address is only required for community residents, not tourists)
    const isTourist = userType === 'นักท่องเที่ยว'
    if (!lineUserId || !fullName || (!isTourist && !address) || !phoneNumber || !gender || !ageRange || !pdpaConsent) {
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
      nickname: nickname || '',
      phoneNumber,
      address,
      gender,
      ageRange,
      userType: userType || '',
      subdistrict: subdistrict || '',
      occupation: occupation || '',
      registrationDate: registrationDate || new Date().toLocaleDateString('th-TH'),
      timestamp: new Date().toISOString(),
    }

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()

    if (!response.ok) {
      return NextResponse.json(
        { 
          error: 'Failed to save registration to Google Sheet',
          details: responseText.substring(0, 200),
          status: response.status,
        },
        { status: 500 }
      )
    }

    // Try to parse JSON response, if it fails just return success anyway
    let result
    try {
      result = JSON.parse(responseText)
    } catch (e) {
      result = { status: 'success', raw: responseText.substring(0, 100) }
    }

    return NextResponse.json({
      success: true,
      data: {
        lineUserId,
        fullName,
        registrationDate,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to submit registration',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
