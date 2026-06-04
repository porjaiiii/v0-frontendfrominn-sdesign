import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwl2YXGleJ8Yy3EOZN5QCZ3G_je8G86fPuMdoTmRbKyLXBidMYULZOvsV15wchusqPP/exec'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { base64Data, fileName, userId } = body

    console.log('[v0] Received image upload request:', { fileName, userId, dataSize: base64Data?.length })

    if (!base64Data || !fileName || !userId) {
      console.log('[v0] Missing required fields for image upload')
      return NextResponse.json(
        { error: 'Missing required fields (base64Data, fileName, userId)' },
        { status: 400 }
      )
    }

    // ส่งข้อมูลรูปไปยัง Google Apps Script เพื่อบันทึกลง Google Drive
    const payload = {
      action: 'uploadImage',
      base64Data,
      fileName,
      userId,
      timestamp: new Date().toISOString(),
    }

    console.log('[v0] Sending image to Google Apps Script for upload...')

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    console.log('[v0] Google Apps Script image upload response status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('[v0] Google Apps Script image upload error:', {
        status: response.status,
        statusText: response.statusText,
        error: error.substring(0, 500)
      })
      return NextResponse.json(
        { 
          error: 'Failed to upload image to Google Drive',
          details: error.substring(0, 200),
        },
        { status: 500 }
      )
    }

    const result = await response.json()
    console.log('[v0] Image uploaded successfully:', result)

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      fileName: result.fileName,
    })
  } catch (error) {
    console.error('[v0] Error uploading image:', error)
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    )
  }
}
