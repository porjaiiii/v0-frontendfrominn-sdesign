import { NextRequest, NextResponse } from 'next/server'

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

interface RecordsPayload {
  records: WasteRecord[]
  stats: { total: number; pending: number }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const parsed = parseSearchParams(searchParams, wasteRecordsQuerySchema)
  if (!parsed.ok) {
    return NextResponse.json({ error: 'user_id parameter is required' }, { status: 400 })
  }

  try {
    const payload: RecordsPayload = await getWasteRecords(parsed.data.user_id)
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[waste/records] error:', error)
    return NextResponse.json({ error: 'Failed to fetch waste records' }, { status: 500 })
  }
}
