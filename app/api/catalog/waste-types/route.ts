import { NextResponse } from 'next/server'

import { WASTE_RATES } from '@/lib/rates'
import { getWasteTypes } from '@/lib/supabase/reads'

/**
 * GET /api/catalog/waste-types
 *
 * Live rates from app.waste_types, replacing the CARBON_FACTORS/POINTS_PER_KG
 * table that used to be copy-pasted into app/home/page.tsx,
 * components/waste-detail-modal.tsx and both waste API routes.
 *
 * Falls back to lib/rates.ts's static values on any DB error — a broken
 * catalog fetch must never take the submission flow down with it, since the
 * numbers here are only an ESTIMATE (the Supabase write path prices for real,
 * server-side, from the same table, inside submit_waste/confirm_waste).
 */
export async function GET() {
  try {
    const types = await getWasteTypes()
    if (types.length > 0) {
      return NextResponse.json({ success: true, wasteTypes: types, isFallback: false })
    }
  } catch (error) {
    console.error('[catalog/waste-types] falling back to static rates:', error)
  }

  const wasteTypes = Object.entries(WASTE_RATES).map(([id, rate]) => ({
    id,
    name: id,
    icon: '',
    carbonFactor: rate.carbonFactor,
    pointsPerKg: rate.pointsPerKg,
  }))

  return NextResponse.json({ success: true, wasteTypes, isFallback: true })
}
