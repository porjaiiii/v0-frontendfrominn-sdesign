import { NextRequest, NextResponse } from 'next/server'

/**
 * Retired: users can no longer delete their own waste records.
 *
 * Once submitted, a record is changed only by staff — confirmed through
 * /api/admin/waste/update, deleted through /api/admin/waste/cancel, both of
 * which name the owner in the body and are gated on an admin session.
 *
 * Kept as a 403 rather than deleted because the LINE webview caches old
 * bundles: a missing route answers with an HTML 404 that those clients fail to
 * parse, where this gives them a message they can show.
 */
function refuse() {
  return NextResponse.json(
    { error: 'ลบรายการได้เฉพาะเจ้าหน้าที่เท่านั้น' },
    { status: 403 },
  )
}

// The request is ignored: nobody may delete here, signed in or not.
export async function POST(_request: NextRequest) {
  return refuse()
}

export async function DELETE(_request: NextRequest) {
  return refuse()
}
