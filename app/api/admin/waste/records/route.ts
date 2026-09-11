import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/admin-session'
import { parseSearchParams } from '@/lib/schemas/common'
import { wasteRecordsQuerySchema } from '@/lib/schemas/waste'
import { getWasteRecords } from '@/lib/supabase/reads'
import type { WasteRecord } from '@/lib/waste-records'

// GET /api/admin/waste/records?user_id=... -> that user's records, for staff.
//
// The staff counterpart to /api/waste/records, which serves only the caller's
// own id. Split rather than widened, for the same reason as
// /api/admin/profile/[id]: "my records" and "anyone's records" are different
// claims, and a handler that answers both is one edit away from answering the
// second to everybody.
//
// READ ONLY, and that is not an oversight: /api/waste/update authorises with
// the LINE identity and writes against identity.lineUserId, so staff cannot
// edit another user's records through it and never could. WasteCart's edit
// controls therefore do nothing useful in admin mode — worth hiding, but that
// is a UI change rather than an authorisation one.
//
// Callers: app/profile-view/[lineUserId] and app/profile-scanner, via
// <WasteCart admin />.
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

interface RecordsPayload {
  records: WasteRecord[]
  stats: { total: number; pending: number }
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const { searchParams } = new URL(request.url)

  const parsed = parseSearchParams(searchParams, wasteRecordsQuerySchema)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: 'user_id parameter is required' },
      { status: 400, headers: NO_STORE },
    )
  }

  try {
    const payload: RecordsPayload = await getWasteRecords(parsed.data.user_id)
    return NextResponse.json(payload, { headers: NO_STORE })
  } catch (error) {
    console.error('[admin/waste/records] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch waste records' },
      { status: 500, headers: NO_STORE },
    )
  }
}
