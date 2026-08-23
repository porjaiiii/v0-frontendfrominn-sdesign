// The single copy of waste pricing that replaces five duplicated
// CARBON_FACTORS/POINTS_PER_KG tables — app/home/page.tsx,
// app/api/waste/submit/route.ts, app/api/waste/update/route.ts,
// components/waste-detail-modal.tsx and lib/app-context.tsx each had their own.
//
// This is the OFFLINE fallback: the numbers below match app.waste_types
// (supabase/migrations/0003_seed_catalog.sql) exactly, but are never fetched —
// they're what renders before GET /api/catalog/waste-types resolves, and what
// stays on screen if that fetch fails. lib/app-context.tsx is what fetches the
// live values and caches them for the session; this module has no I/O.
//
// The Supabase write path (app.submit_waste / app.confirm_waste RPCs) never
// reads this file — it prices server-side, directly from app.waste_types. This
// is purely the client-side estimate shown before a submission is confirmed.

export type WasteType = 'plastic' | 'paper' | 'glass' | 'aluminum' | 'oil'

export interface WasteRate {
  /** kg CO2e saved per kg of this material. */
  carbonFactor: number
  pointsPerKg: number
}

export const WASTE_RATES: Record<WasteType, WasteRate> = {
  plastic:  { carbonFactor: 1.0310, pointsPerKg: 6 },
  paper:    { carbonFactor: 3.5460, pointsPerKg: 4 },
  glass:    { carbonFactor: 0.2760, pointsPerKg: 4 },
  aluminum: { carbonFactor: 9.1270, pointsPerKg: 25 },
  // Seeded in app.waste_types but is_active = false — absent from
  // lib/waste-data.ts's WASTE_TYPES, so no UI flow can select it. Kept so this
  // table stays a faithful mirror of app.waste_types.
  oil:      { carbonFactor: 3.0,    pointsPerKg: 3 },
}

function isWasteType(value: string): value is WasteType {
  return value in WASTE_RATES
}

/** Falls back to the plastic-ish default the legacy script used for an unrecognised type. */
export function carbonFactorFor(wasteType: string, rates: Record<string, WasteRate> = WASTE_RATES): number {
  return (isWasteType(wasteType) ? rates[wasteType]?.carbonFactor : undefined) ?? 1.0
}

export function pointsPerKgFor(wasteType: string, rates: Record<string, WasteRate> = WASTE_RATES): number {
  return (isWasteType(wasteType) ? rates[wasteType]?.pointsPerKg : undefined) ?? 3
}
