import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/admin-session'
import { parseSearchParams } from '@/lib/schemas/common'
import { wasteRecordsQuerySchema } from '@/lib/schemas/waste'
import { getAccount } from '@/lib/supabase/reads'

// GET /api/admin/points?user_id=... -> that user's points account, for staff.
//
// The staff counterpart to GET /api/points, which serves only the caller's own
// account. Split rather than widened, for the same reason as
// /api/admin/waste/records: "my points" and "anyone's points" are different
// claims, and the second one used to leak through POST /api/points to anybody.
//
// READ ONLY. Points change only through confirm_waste and the spend RPCs.
//
// Callers: app/profile-view/[lineUserId] and app/profile-scanner, via
// <AdminPointsCard />.
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const { searchParams } = new URL(request.url)

  // Same `user_id` contract as the records route.
  const parsed = parseSearchParams(searchParams, wasteRecordsQuerySchema)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: 'user_id parameter is required' },
      { status: 400, headers: NO_STORE },
    )
  }

  try {
    // Null for a user with no balance row yet — not an error, just nothing earned.
    const account = await getAccount(parsed.data.user_id)
    return NextResponse.json({ success: true, account }, { headers: NO_STORE })
  } catch (error) {
    console.error('[admin/points] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch points' },
      { status: 500, headers: NO_STORE },
    )
  }
}
