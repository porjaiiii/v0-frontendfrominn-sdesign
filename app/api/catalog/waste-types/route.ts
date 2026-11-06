import { NextResponse } from 'next/server'

import { getWasteTypes } from '@/lib/supabase/reads'

/**
 * GET /api/catalog/waste-types
 *
 * Live carbon rates from app.waste_types and points rates from
 * app.waste_subtypes, replacing the CARBON_FACTORS/POINTS_PER_KG table that
 * used to be copy-pasted into app/home/page.tsx and components/waste-detail-modal.tsx.
 *
 * This used to answer 200 with a static copy of those rates from lib/rates.ts
 * whenever the read failed, flagged `isFallback: true` — which nothing checked.
 * A rate edited in the database and not mirrored in that file would be served
 * here as though it were live, so the estimate on screen and the points
 * actually awarded could disagree with nothing reporting it. The copy is gone:
 * if the rates cannot be read, this says so.
 *
 * Submitting still works regardless. The client shows "—" instead of an
 * estimate, and the real pricing happens server-side inside
 * submit_waste/confirm_waste, which read the catalog tables directly.
 */
export async function GET() {
  try {
    const types = await getWasteTypes()

    if (types.length === 0) {
      console.error('[catalog/waste-types] app.waste_types returned no rows')
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถโหลดอัตราคำนวณได้' },
        { status: 503 },
      )
    }

    return NextResponse.json({ success: true, wasteTypes: types })
  } catch (error) {
    console.error('[catalog/waste-types] read failed:', error)
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถโหลดอัตราคำนวณได้' },
      { status: 503 },
    )
  }
}
