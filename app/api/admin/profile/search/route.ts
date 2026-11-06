import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/admin-session'
import { searchProfilesByPhone } from '@/lib/supabase/reads'

// GET /api/admin/profile/search?phone=0812345678 — staff find a user by phone
// number when the user's QR is not to hand.
//
// Admin only, like /api/admin/profile/[id]: a phone number is PDPA-regulated, so
// "can sign in to the app" must not be enough to look people up by it.
//
// Deliberately narrow, since this is a lookup over personal data:
//   - at least 7 digits, so it cannot be used to list the table by typing "0";
//   - at most 10 results;
//   - only what staff need to pick the right person. The phone itself and the
//     address are not returned — just the last four digits, to tell two people
//     with similar names apart.
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

const MIN_DIGITS = 7
const MAX_DIGITS = 15

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const raw = new URL(request.url).searchParams.get('phone') ?? ''
  if (!/^\d+$/.test(raw) || raw.length < MIN_DIGITS || raw.length > MAX_DIGITS) {
    return NextResponse.json(
      { error: `Phone must be ${MIN_DIGITS}-${MAX_DIGITS} digits` },
      { status: 400, headers: NO_STORE },
    )
  }

  try {
    const profiles = await searchProfilesByPhone(raw)

    return NextResponse.json(
      {
        success: true,
        users: profiles.map((p) => ({
          lineUserId: p.lineUserId,
          userId: p.userId,
          fullName: p.fullName,
          nickname: p.nickname,
          userType: p.userType,
          subdistrict: p.subdistrict,
          phoneLast4: p.phoneNumber.replace(/\D/g, '').slice(-4),
        })),
      },
      { headers: NO_STORE },
    )
  } catch (error) {
    console.error('[admin/profile/search] error:', error)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500, headers: NO_STORE })
  }
}
