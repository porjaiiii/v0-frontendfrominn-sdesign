import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxXbPMRk1PXSbw5vLEvbCQPfFkPZithJXStciUM2oZ__y9ct1OPVUlM-YfvF7ZpDVKG/exec'

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

    // Validate required fields
    if (!lineUserId || !fullName || !address || !phoneNumber || !gender || !ageRange || !pdpaConsent) {
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
