import { NextRequest, NextResponse } from 'next/server'

import { getProfile } from '@/lib/supabase/reads'

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

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: lineId } = await context.params

    if (!lineId) {
      return NextResponse.json({ error: 'LINE ID is required' }, { status: 400 })
    }

    return await respondFromSupabase(lineId)
  } catch (error) {
    console.error('[profile] error:', error)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }
}
