import { NextRequest, NextResponse } from 'next/server'

import { requireSelf } from '@/lib/auth/require-self'
import { getProfile } from '@/lib/supabase/reads'

// GET /api/profile/[id] -> YOUR OWN profile. `id` must match the LINE ID token.
//
// This row is PDPA-regulated — full name, phone number, home address — and the
// route used to return it for any id in the URL with no token at all. A LINE
// user id is not a secret (it travels in QR codes, links and the GAS
// integration), so knowing one was never authorisation to read the person
// behind it.
//
// Staff who need someone else's profile use /api/admin/profile/[id], which
// asks for an admin session instead. Keeping them apart is deliberate: see the
// note there.

// One query. The Apps Script path this replaced needed 60 s of retries to
// survive a cold start.
export const maxDuration = 15

// Never cache profile lookups. A stale 404 (e.g. fetched right after a row was
// deleted during testing) would otherwise keep a re-registered user flagged as
// "not registered" until their browser cache cleared.
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

const GENERIC_ERROR = 'เกิดข้อผิดพลาดในการสดงผลโปรดลองอีกครั้งภายหลัง'

/**
 * No fail-open-503 branch: "no row" and "the backend is unwell" are different
 * outcomes here, so a miss is an honest 404. Apps Script's getUser returned
 * status:'error' for both, so that path had to fail open or a cold start would
 * bounce a registered user back to /register.
 */
async function respondFromSupabase(lineId: string) {
  const profile = await getProfile(lineId)

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json(profile, { headers: NO_STORE })
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: lineId } = await context.params

    if (!lineId) {
      return NextResponse.json({ error: 'LINE ID is required' }, { status: 400 })
    }

    const access = await requireSelf(request, lineId)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status, headers: NO_STORE })
    }

    return await respondFromSupabase(access.lineUserId)
  } catch (error) {
    console.error('[profile] error:', error)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }
}
