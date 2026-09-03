// The coupon record shape shared by the API routes and the client.
//
// This file used to also export COUPON_SCRIPT_URL, the Apps Script web app every
// coupon route posted to. Coupons live in app.coupons now; the column reference
// below is kept because the field names carried over verbatim.

// ─── Field reference ───────────────────────────────────────────────────────
//
// TABLE: app.coupons
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
export type RedeemType = 'pickup' | 'delivery'

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
  redeem_type?: RedeemType
}
