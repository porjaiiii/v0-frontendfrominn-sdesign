import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/admin-session'
import { getProfile } from '@/lib/supabase/reads'

// GET /api/admin/profile/[id] -> the full profile of ANY user, for staff.
//
// Split out of /api/profile/[id] rather than widening it. Reading your own
// profile and reading somebody else's are different claims, and serving both
// from one handler is exactly how the second ended up available to everyone:
// that route took the id from the URL and returned the PDPA-regulated row —
// name, phone, address — with no token at all.
//
// Staff prove themselves with the admin session cookie (lib/auth/admin-session
// .ts), which is a separate claim from being a signed-in LINE user: being able
// to log into the app must not be enough to read other people's records.
//
// Callers: app/profile-view/[lineUserId] and app/profile-scanner.
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  try {
    const { id: lineUserId } = await context.params

    if (!lineUserId) {
      return NextResponse.json(
        { error: 'LINE ID is required' },
        { status: 400, headers: NO_STORE },
      )
    }

    const profile = await getProfile(lineUserId)

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: NO_STORE })
    }

    return NextResponse.json(profile, { headers: NO_STORE })
  } catch (error) {
    console.error('[admin/profile] error:', error)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500, headers: NO_STORE })
  }
}
