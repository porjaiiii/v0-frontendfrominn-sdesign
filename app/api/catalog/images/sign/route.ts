import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/admin-session'
import { catalogImageUploadSchema } from '@/lib/schemas/catalog'
import { parseJsonBody } from '@/lib/schemas/common'
import { createCatalogImageUpload } from '@/lib/supabase/storage'

/**
 * POST /api/catalog/images/sign — admin only.
 *
 * Same pattern as /api/upload-image/sign (Phase 6): the browser PUTs the
 * compressed Blob straight to storage, never through this function. The
 * difference is the bucket — catalog-images is public-read, so once uploaded
 * the path resolves to a public URL with no signing needed (see
 * lib/supabase/storage.ts's catalogImageUrl).
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'ต้องเข้าสู่ระบบเจ้าหน้าที่ก่อน' }, { status: 403 })
  }

  const parsed = await parseJsonBody(request, catalogImageUploadSchema)
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status })
  }

  try {
    const upload = await createCatalogImageUpload(parsed.data.kind, parsed.data.contentType)
    return NextResponse.json({
      success: true,
      path: upload.path,
      signedUrl: upload.signedUrl,
      token: upload.token,
    })
  } catch (error) {
    console.error('[catalog/images/sign] failed:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถเตรียมการอัปโหลดได้ กรุณาลองใหม่' },
      { status: 500 },
    )
  }
}
