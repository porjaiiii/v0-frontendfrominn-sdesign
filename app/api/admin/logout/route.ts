import { NextResponse } from 'next/server'

import { clearAdminCookie } from '@/lib/auth/admin-session'

/** POST /api/admin/logout — drop the session cookie. */
export async function POST() {
  await clearAdminCookie()
  return NextResponse.json({ success: true })
}
