// Waste pricing types and lookups.
//
// This module used to hold a second copy of the catalog rates, kept in sync by
// hand and used whenever the live values had not arrived. That copy is gone.
//
// The live rates come from GET /api/catalog/waste-types, cached for the session
// by lib/app-context.tsx. Until they arrive — or if that fetch fails — the
// lookups below return null and the screens render "—". A missing number is
// honest; a stale one is not.
//
// None of this touches what the user is actually awarded. app.submit_waste and
// app.confirm_waste price server-side from the catalog and have never read
// this file.

export type WasteType = 'plastic' | 'paper' | 'glass' | 'aluminum' | 'oil'

export interface WasteRate {
  /** kg CO2e saved per kg of this material. */
  carbonFactor?: number
  pointsPerKg?: number
}

/** The session's live rates, or null while they are still loading. */
export type WasteRates = Record<string, WasteRate> | null

/** kg CO2e per kg, or null if that cannot be known right now. */
export function carbonFactorFor(wasteType: string, rates: WasteRates): number | null {
  return usable(rates?.[wasteType]?.carbonFactor)
}

/** Points per kg for a subtype, or null if that cannot be known right now. */
export function pointsPerKgFor(
  wasteType: string,
  wasteSubtype: string,
  rates: WasteRates,
): number | null {
  return usable(rates?.[rateKey(wasteType, wasteSubtype)]?.pointsPerKg)
}

/** NaN and Infinity reach here from a malformed row; neither is a rate. */
function usable(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function rateKey(wasteType: string, wasteSubtype: string): string {
  return `${wasteType}:${wasteSubtype}`
}
