// The write-freeze switch.
//
// This is what remains of lib/backend-flags.ts. That module also carried
// `backendFor()`, a per-route gas|supabase selector that made the cutover and
// its rollback a 30-second env flip. Every route now runs on Supabase and the
// Apps Script branches are gone, so the selector went with them — but the
// freeze window is useful on its own and is unrelated to which backend serves a
// request.

/** Freeze window. Routes refuse writes and serve reads read-only. */
export function isMaintenance(): boolean {
  const value = process.env.MAINTENANCE?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'on'
}

export const MAINTENANCE_MESSAGE =
  'ระบบกำลังปรับปรุงชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่'
