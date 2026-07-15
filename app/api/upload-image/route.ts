import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzJnOKocFO6Tyqsy7NUn060BtFr4oAtE4jaHbcrsMcEozzJLl0JcXvY4VAxg-XvkGu2/exec'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { base64Data, fileName, userId, wasteType, weight } = body

    console.log('[v0] Received image upload request:', { fileName, userId, wasteType, weight, dataSize: base64Data?.length })

    if (!base64Data || !userId) {
      console.log('[v0] Missing required fields for image upload')
      return NextResponse.json(
        { error: 'Missing required fields (base64Data, userId)' },
        { status: 400 }
      )
    }

    // สร้างชื่อไฟล์ใหม่: userId_wasteType_weight_timestamp.jpg
    const timestamp = Date.now()
    const generatedFileName = wasteType && weight 
      ? `${userId}_${wasteType}_${weight}_${timestamp}.jpg`
      : `${userId}_${timestamp}.jpg`

    console.log('[v0] Generated filename:', generatedFileName)

    // ส่งข้อมูลรูปไปยัง Google Apps Script เพื่อบันทึกลง Google Drive
    const payload = {
      action: 'uploadImage',
      base64Data,
      fileName: generatedFileName,
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
    console.log('[v0] Image uploaded successfully - Full response:', JSON.stringify(result, null, 2))
    
    const finalImageUrl = result.imageUrl || result.image_url

    console.log('[v0] finalImageUrl value:', finalImageUrl)

    if (!finalImageUrl) {
      console.error('[v0] Upload response error - no imageUrl found in result object')
      return NextResponse.json(
        { 
          error: 'Google Drive uploaded successfully but failed to return image URL',
          details: JSON.stringify(result)
        },
        { status: 500 }
      )
    }

    console.log('[v0] Returning to client:', {
      success: true,
      imageUrl: finalImageUrl,
      fileName: generatedFileName,
    })

    return NextResponse.json({
      success: true,
      imageUrl: finalImageUrl,
      fileName: generatedFileName,
    })
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[v0] Error uploading image:', {
      error: errorMsg,
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { 
        error: 'Failed to upload image',
        details: errorMsg,
      },
      { status: 500 }
    )
  }
}
