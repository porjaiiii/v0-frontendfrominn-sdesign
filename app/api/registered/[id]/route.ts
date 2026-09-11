import { NextRequest, NextResponse } from 'next/server'

import { hasGasSecret } from '@/lib/auth/gas-secret'
import { isRegistered } from '@/lib/supabase/reads'

// GET /api/registered/{lineUserId} -> { registered: boolean }
//
// Exists solely for GAS #3, which switches a user's LINE rich menu on `follow`
// and needs to know whether they have registered. It used to read the GAS-era
// registration spreadsheet directly; nothing has written to that sheet since
// the Supabase migration, so every post-migration user looked unregistered.
//
// Deliberately NOT /api/profile/[id]: that returns the full PDPA-regulated row
// (name, phone, address) and is unauthenticated. This answers one boolean, and
// only to a caller holding the shared secret — otherwise it would be a free
// "is this LINE id one of your users?" oracle for anyone who can guess ids.
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasGasSecret(request)) {
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

    return NextResponse.json({ registered: await isRegistered(lineUserId) }, { headers: NO_STORE })
  } catch (error) {
    // A 500 must not read as "not registered" — the caller fails closed on any
    // non-200, which keeps an unregistered user off the registered menu.
    console.error('[registered] error:', error)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500, headers: NO_STORE })
  }
}
