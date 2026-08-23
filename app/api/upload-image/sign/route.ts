import { NextRequest, NextResponse } from 'next/server'

import { getLineIdentity } from '@/lib/auth/verify-line-token'
import { isMaintenance, MAINTENANCE_MESSAGE } from '@/lib/maintenance'
import { createWastePhotoUpload } from '@/lib/supabase/storage'

/**
 * POST /api/upload-image/sign — get a one-shot URL to PUT a photo to.
 *
 * The browser then PUTs the compressed Blob straight to storage. Nothing about
 * the image passes through this function, which is the point: the old flow sent
 * base64 through a Vercel function, and base64's 33% inflation against the
 * 4.5MB body limit is why lib/compress-image had to squeeze evidence photos
 * down to 0.5MB.
 *
 * The client does NOT choose the path. It is built server-side from the verified
 * LINE ID token (lib/supabase/storage.ts), so a signed upload URL can never be
 * turned into a write into someone else's prefix.
 */
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function POST(request: NextRequest) {
  if (isMaintenance()) {
    return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 })
  }

  const identity = await getLineIdentity(request)
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const contentType = typeof body?.contentType === 'string' ? body.contentType : 'image/jpeg'

  if (!ALLOWED.has(contentType)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${contentType}` },
      { status: 415 },
    )
  }

  try {
    const upload = await createWastePhotoUpload(identity.lineUserId, contentType)
    return NextResponse.json({
      success: true,
      path: upload.path,
      signedUrl: upload.signedUrl,
      token: upload.token,
    })
  } catch (error) {
    console.error('[upload-image/sign] failed:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถเตรียมการอัปโหลดได้ กรุณาลองใหม่' },
      { status: 500 },
    )
  }
}
