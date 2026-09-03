import { NextRequest, NextResponse } from 'next/server'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { uploadWastePhoto } from '@/lib/supabase/storage'

/**
 * Deprecated base64 shim.
 *
 * New clients call POST /api/upload-image/sign and PUT the Blob straight to
 * storage; nothing about the image passes through a Vercel function. This route
 * stays only so that a browser running an older bundle keeps working across a
 * deploy — it used to be where the Google Drive upload lived.
 *
 * Keep the 4.5MB body limit in mind: base64 inflates by ~33%, which is the
 * entire reason lib/compress-image used to target 0.5MB.
 */
async function uploadBase64(request: NextRequest, base64Data: string) {
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
    const { base64Data } = await request.json()

    if (!base64Data) {
      return NextResponse.json({ error: 'Missing base64Data' }, { status: 400 })
    }

    return await uploadBase64(request, base64Data)
  } catch (error) {
    console.error('[upload-image] error:', error)
    return NextResponse.json({ error: 'ไม่สามารถอัปโหลดรูปได้' }, { status: 500 })
  }
}
