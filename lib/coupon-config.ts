/**
 * Single source of truth for the coupon Google Apps Script web app.
 *
 * Google Sheet tabs used:
 *  - coupons            : ตาราง coupon ทั้งหมด
 *  - coupon_templates   : แม่แบบของรางวัลแต่ละชนิด (ถ้ามี)
 *
 * ถ้า redeploy Apps Script ให้เปลี่ยน URL ที่นี่ที่เดียว
 * ทุก route import จากไฟล์นี้
 */
export const COUPON_SCRIPT_URL =
  'https://script.google.com/macros/s/YOUR_COUPON_SCRIPT_ID_HERE/exec'

// ─── Field reference ───────────────────────────────────────────────────────
//
// TABLE: coupons
// ─────────────────────────────────────────────────────────────────────────
// coupon_id          string      PK — รหัส coupon (= payload ของ QR Code)
//                                     Format: CPNxxxxxxxx-xxxx-xxxx
// user_id            string      LINE userId ของเจ้าของ coupon
// reward_id          number      อ้างอิงไปหา reward template
// reward_name        string      ชื่อรางวัล ณ เวลาแลก (snapshot)
// reward_description string      คำอธิบายรางวัล (snapshot)
// reward_image       string      URL รูปรางวัล (snapshot)
// points_used        number      คะแนนที่ใช้แลก
// tx_id              string      รหัส transaction จาก points ledger (อ้างอิงข้าม sheet)
// status             string      'active' | 'used' | 'expired'
// redeemed_at        ISO string  วันเวลาที่สร้าง coupon
// used_at            ISO string  วันเวลาที่ใช้งาน (nullable)
// expires_at         ISO string  วันหมดอายุ (nullable)
// scanned_by         string      LINE userId / staff ID ที่สแกน (nullable)
// ─────────────────────────────────────────────────────────────────────────

export type CouponStatus = 'active' | 'used' | 'expired'

/** Shape ของ coupon record ที่รับ/ส่งระหว่าง Next.js ↔ GAS */
export interface CouponRecord {
  coupon_id: string
  user_id: string
  reward_id: number
  reward_name: string
  reward_description: string
  reward_image: string
  points_used: number
  tx_id?: string
  status: CouponStatus
  redeemed_at: string   // ISO datetime
  used_at?: string      // ISO datetime | undefined
  expires_at?: string   // ISO datetime | undefined
  scanned_by?: string
}
