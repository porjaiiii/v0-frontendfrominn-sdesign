import { NextRequest, NextResponse } from 'next/server'

import { requireSelf } from '@/lib/auth/require-self'
import { parseSearchParams } from '@/lib/schemas/common'
import { wasteRecordsQuerySchema } from '@/lib/schemas/waste'
import { getWasteRecords } from '@/lib/supabase/reads'
import type { WasteRecord } from '@/lib/waste-records'

// GET /api/waste/records?user_id=...
//
// Returns TYPED OBJECTS, not the array-of-arrays Apps Script produced.
//
// This is a net deletion: mapWasteRecords (lib/waste-records.ts) used to run in
// three separate places on the client, once as a hand-inlined copy in
// components/waste-cart.tsx.
//
// `user_id` must match the LINE ID token. It used to be honoured unverified,
// which made one person's disposal history readable by anyone holding their
// LINE id.

interface RecordsPayload {
  records: WasteRecord[]
  stats: { total: number; pending: number }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const access = await requireSelf(request, searchParams.get('user_id'))
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const parsed = parseSearchParams(searchParams, wasteRecordsQuerySchema)
  if (!parsed.ok) {
    return NextResponse.json({ error: 'user_id parameter is required' }, { status: 400 })
  }

  try {
    // The token's id, not the query string's — they are equal here, and reading
    // from the verified one keeps it that way if the check above ever moves.
    const payload: RecordsPayload = await getWasteRecords(access.lineUserId)
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[waste/records] error:', error)
    return NextResponse.json({ error: 'Failed to fetch waste records' }, { status: 500 })
  }
}
