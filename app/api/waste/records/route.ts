import { NextRequest, NextResponse } from 'next/server'

import { backendFor } from '@/lib/backend-flags'
import { parseSearchParams } from '@/lib/schemas/common'
import { wasteRecordsQuerySchema } from '@/lib/schemas/waste'
import { getWasteRecords } from '@/lib/supabase/reads'
import { mapWasteRecords, type WasteRecord } from '@/lib/waste-records'

// GET /api/waste/records?user_id=...
//
// Returns TYPED OBJECTS, not the array-of-arrays GAS produced. Both backends
// emit the identical shape, so flipping BACKEND_WASTE_RECORDS never changes the
// contract — it only changes where the rows come from.
//
// This is a net deletion: mapWasteRecords (lib/waste-records.ts) used to run in
// three separate places on the client, once as a hand-inlined copy in
// components/waste-cart.tsx. It now runs once, here, on the GAS path only.

const GOOGLE_APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_GAS_URL1 ?? ''

interface RecordsPayload {
  records: WasteRecord[]
  stats: { total: number; pending: number }
}

async function fromGas(userId: string): Promise<RecordsPayload> {
  const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getRecords', user_id: userId, type: 'query' }),
  })

  if (!response.ok) {
    throw new Error(`Apps Script error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // getRecords returns the whole sheet — mapWasteRecords does the per-user
  // filtering that every caller used to do for itself.
  const records = mapWasteRecords(data.records ?? [], userId)

  return {
    records,
    // Scoped to this user. GAS computed `stats` across every row in the sheet,
    // so its `pending` was a global count presented as the caller's own. No
    // consumer reads this field today, so correcting it breaks nothing.
    stats: {
      total: records.length,
      pending: records.filter((r) => r.status === 'pending').length,
    },
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const parsed = parseSearchParams(searchParams, wasteRecordsQuerySchema)
  if (!parsed.ok) {
    return NextResponse.json({ error: 'user_id parameter is required' }, { status: 400 })
  }

  try {
    const payload =
      backendFor('wasteRecords') === 'supabase'
        ? await getWasteRecords(parsed.data.user_id)
        : await fromGas(parsed.data.user_id)

    return NextResponse.json(payload)
  } catch (error) {
    console.error('[waste/records] error:', error)
    return NextResponse.json({ error: 'Failed to fetch waste records' }, { status: 500 })
  }
}
