import { NextRequest, NextResponse } from 'next/server'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { backendFor } from '@/lib/backend-flags'
import { uploadWastePhoto } from '@/lib/supabase/storage'

const GOOGLE_APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_GAS_URL1 ?? ''

/**
 * Deprecated base64 shim.
 *
 * New clients call POST /api/upload-image/sign and PUT the Blob straight to
 * storage; nothing about the image passes through a Vercel function. This route
 * stays so that a browser running an older bundle keeps working across a deploy,
 * and it is where the Drive path lives until the flag is retired.
 *
 * Keep the 4.5MB body limit in mind: base64 inflates by ~33%, which is the
 * entire reason lib/compress-image used to target 0.5MB.
 */
async function respondFromSupabase(request: NextRequest, base64Data: string) {
  const identity = await getLineIdentity(request)
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64')
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Empty image payload' }, { status: 400 })
    }

    const path = await uploadWastePhoto(identity.lineUserId, buffer, 'image/jpeg')

    // `imageUrl` is the field every existing caller reads. It now carries a
    // storage PATH rather than a URL — getWasteRecords signs it on the way out,
    // and a value that is already a URL (a legacy Drive link) is passed through
    // untouched.
    return NextResponse.json({ success: true, imageUrl: path, fileName: path })
  } catch (error) {
    console.error('[upload-image] supabase upload failed:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถอัปโหลดรูปได้ กรุณาลองใหม่' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { base64Data, fileName, userId, wasteType, weight } = body

    if (backendFor('wasteSubmit') === 'supabase') {
      if (!base64Data) {
        return NextResponse.json({ error: 'Missing base64Data' }, { status: 400 })
      }
      return await respondFromSupabase(request, base64Data)
    }

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
          error: 'เกิดข้ปิดพลาดในการอัพโหลดรูป',
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
          error: 'เกิดปัญหาในการอัพโหลดรูปภาพ โปรดลองอัพโหลดใหม่จนเห็นรูปแสดงขึ้นมา',
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
        error: 'อัพโหลดรูปไม่สำเร็จกรูณาลองอีกครั้งจนกว่าจะเห็นรูปแสดงขึ้นมา',
        details: errorMsg,
      },
      { status: 500 }
    )
  }
}
