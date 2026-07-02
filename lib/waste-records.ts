// Shared helpers for the trash-side "submission" sheet, served as raw rows by
// GET /api/waste/records. The parsing here mirrors the inline logic in
// components/waste-cart.tsx so the history pages read the same shape.
//
// Sheet columns (array index):
//   0 timestamp        1 user_id           2 waste_type      3 waste_subtype
//   4 weight_kg        5 image_urls        6 carbon_reduction
//   7 points_earned    8 status            9 notes

import { WASTE_TYPES, WASTE_SUBTYPES } from '@/lib/waste-data'
import type { WasteType } from '@/lib/app-context'

export interface WasteRecord {
  timestamp: string
  user_id: string
  waste_type: string
  waste_subtype: string
  weight_kg: number
  image_urls: string[]
  carbon_reduction: number
  points_earned: number
  status: string
  notes?: string
}

// image_urls can arrive as a JSON array string ("[\"a\",\"b\"]"),
// a comma-separated string ("a,b"), or a single URL.
export function parseImageUrls(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((u) => String(u).trim()).filter(Boolean)
  const s = String(raw).trim()
  if (!s) return []
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      const parsed = JSON.parse(s)
      return Array.isArray(parsed) ? parsed.map((u) => String(u).trim()).filter(Boolean) : [s]
    } catch {
      return [s]
    }
  }
  if (s.includes(',')) return s.split(',').map((u) => u.trim()).filter(Boolean)
  return [s]
}

// Map raw sheet rows (array-of-arrays from /api/waste/records) to typed records,
// filtered to a single user.
export function mapWasteRecords(rows: unknown[], userId: string): WasteRecord[] {
  return (rows ?? [])
    .filter((row): row is unknown[] => Array.isArray(row) && row[1] === userId)
    .map((row) => ({
      timestamp: String(row[0] ?? ''),
      user_id: String(row[1] ?? ''),
      waste_type: String(row[2] ?? ''),
      waste_subtype: String(row[3] ?? ''),
      weight_kg: parseFloat(String(row[4])) || 0,
      image_urls: parseImageUrls(row[5]),
      carbon_reduction: parseFloat(String(row[6])) || 0,
      points_earned: parseFloat(String(row[7])) || 0,
      status: String(row[8] ?? ''),
      notes: row[9] != null ? String(row[9]) : undefined,
    }))
}

// Thai label for a waste type id (e.g. 'plastic' -> 'พลาสติก'), falling back to
// the raw id when unknown.
export function wasteTypeName(typeId: string): string {
  return WASTE_TYPES.find((t) => t.id === typeId)?.name ?? typeId
}

// Thai label for a subtype id within a type (e.g. 'pet' -> 'ขวดน้ำพลาสติกใส'),
// falling back to the raw id. Newlines in names are collapsed to spaces.
export function wasteSubtypeName(typeId: string, subId: string): string {
  const list = WASTE_SUBTYPES[typeId as WasteType]
  const name = list?.find((s) => s.id === subId)?.name
  return (name ?? subId).replace(/\s*\n\s*/g, ' ')
}
