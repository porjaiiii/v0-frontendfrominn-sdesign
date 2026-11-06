import { NextRequest, NextResponse } from 'next/server'

/**
 * Retired: users can no longer confirm or edit their own waste records.
 *
 * Confirming is what weighs a record and awards its points, and this route took
 * the weight from the owner's own request — so any signed-in user could mark
 * their cart done at whatever weight they typed and award themselves the
 * points. Staff weigh and confirm through /api/admin/waste/update instead,
 * which names the owner in the body and is gated on an admin session.
 *
 * Kept as a 403 rather than deleted because the LINE webview caches old
 * bundles: a missing route answers with an HTML 404 that those clients fail to
 * parse, where this gives them a message they can show.
 */
function refuse() {
  return NextResponse.json(
    { error: 'ยืนยันข้อมูลได้เฉพาะเจ้าหน้าที่เท่านั้น' },
    { status: 403 },
  )
}

// The request is ignored: nobody may confirm here, signed in or not.
export async function PUT(_request: NextRequest) {
  return refuse()
}

export async function POST(_request: NextRequest) {
  return refuse()
}
