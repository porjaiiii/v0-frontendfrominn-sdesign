// Waste pricing types and lookups.
//
// This module used to hold a second copy of app.waste_types — the same five
// rates as supabase/migrations/0003_seed_catalog.sql, kept in sync by hand and
// used whenever the live values had not arrived. That copy is gone. It could
// only ever be right by coincidence: change a rate in the database and forget
// this file, and the user is shown one estimate while the server awards another,
// with nothing anywhere reporting the disagreement.
//
// The live rates come from GET /api/catalog/waste-types, cached for the session
// by lib/app-context.tsx. Until they arrive — or if that fetch fails — the
// lookups below return null and the screens render "—". A missing number is
// honest; a stale one is not.
//
// None of this touches what the user is actually awarded. app.submit_waste and
// app.confirm_waste price server-side from app.waste_types and have never read
// this file (supabase/migrations/0004_rpc_waste.sql:145).

export type WasteType = 'plastic' | 'paper' | 'glass' | 'aluminum' | 'oil'

export interface WasteRate {
  /** kg CO2e saved per kg of this material. */
  carbonFactor: number
  pointsPerKg: number
}

/** The session's live rates, or null while they are still loading. */
export type WasteRates = Record<string, WasteRate> | null

/** kg CO2e per kg, or null if that cannot be known right now. */
export function carbonFactorFor(wasteType: string, rates: WasteRates): number | null {
  return usable(rates?.[wasteType]?.carbonFactor)
}

/** Points per kg, or null if that cannot be known right now. */
export function pointsPerKgFor(wasteType: string, rates: WasteRates): number | null {
  return usable(rates?.[wasteType]?.pointsPerKg)
}

/** NaN and Infinity reach here from a malformed row; neither is a rate. */
function usable(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
