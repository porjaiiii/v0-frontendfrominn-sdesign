/**
 * Single source of truth for the Admin Google Apps Script web app.
 *
 * Google Sheet tabs used:
 *  - AdminKeys : ตาราง admin key ทั้งหมด
 *
 * ถ้า redeploy Apps Script ให้เปลี่ยน URL ที่นี่ที่เดียว
 */
export const ADMIN_SCRIPT_URL = process.env.NEXT_PUBLIC_GAS_URL1 ?? ''

// ─── Field reference ───────────────────────────────────────────────────────
//
// TABLE: AdminKeys
// ──────────────────────────────────────────────────────────────────────────
// admin_key      string   PK — รหัส admin key ที่กำหนดไว้ล่วงหน้า
// status         string   'inactive' | 'active'
// line_user_id   string   LINE userId ที่ผูกกับ key นี้ (nullable)
// activated_at   string   ISO datetime ที่ activate (nullable)
// ──────────────────────────────────────────────────────────────────────────
