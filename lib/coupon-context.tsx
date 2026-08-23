'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { apiFetch, newIdempotencyKey } from './api-client'
import { useLiffContext } from './liff-context'

export interface RedeemParams {
  /** `points` is honoured only for a variable-price reward; ignored otherwise. */
  items: { reward_id: number; quantity?: number; points?: number }[]
  redeem_type?: 'pickup' | 'delivery'
}

export interface RedeemResult {
  coupons: Coupon[]
  tx_id: string
  points_used: number
}

/**
 * Database fields design:
 *
 * TABLE: coupons
 * ─────────────────────────────────────────────────────
 * coupon_id         string   PK — also the QR code payload
 * user_id           string   LINE user ID of the coupon owner
 * reward_id         number   Reference to REWARDS list
 * reward_name       string   Snapshot of reward name at redemption time
 * reward_description string   Snapshot of reward description
 * reward_image      string   Path to reward image
 * points_used       number   Points spent to redeem
 * tx_id             string   Reference to points transaction ID
 * redeem_type       string   'pickup' | 'delivery' (เพิ่มคอลัมน์นี้)
 * status            enum     'active' | 'used' | 'expired'
 * redeemed_at       string   ISO — when the coupon was created
 * used_at           string   ISO — when the coupon was scanned/used (nullable)
 * expires_at        string   ISO — expiry date (nullable, optional)
 * scanned_by        string   staff ID that scanned (nullable)
 */

export interface Coupon {
  coupon_id: string
  user_id: string
  reward_id: number
  reward_name: string
  reward_description: string
  reward_image: string
  points_used: number
  tx_id?: string
  redeem_type?: 'pickup' | 'delivery' // 🟢 เพิ่มประเภทรูปแบบการรับ
  status: 'active' | 'used' | 'expired'
  redeemed_at: string
  used_at?: string
  expires_at?: string
  scanned_by?: string
}

interface CouponContextType {
  coupons: Coupon[]
  loading: boolean
  /** Spend points and mint the coupons in one server-side transaction. */
  redeemRewards: (params: RedeemParams) => Promise<RedeemResult>
  /** Fetch a single coupon by ID — GET /api/coupons/[id] */
  getCoupon: (coupon_id: string) => Promise<Coupon | undefined>
  /** Mark a coupon as used — POST /api/coupons/use */
  markUsed: (coupon_id: string, scanned_by?: string) => Promise<void>
  /** Re-fetch coupon list from backend */
  refresh: () => Promise<void>
}

const CouponContext = createContext<CouponContextType | undefined>(undefined)

export function CouponProvider({ children }: { children: ReactNode }) {
  const { profile } = useLiffContext()
  // No fake identity here any more — a coupon list fetched under a made-up
  // 'demo_user' id was always an empty list dressed up as a real answer.
  // Without a real LINE profile there is nothing to fetch, so we don't try.
  const userId = profile?.userId ?? null

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)

  // ── Fetch coupon list from backend: GET /api/coupons?user_id=xxx ──────────
  const fetchCoupons = useCallback(async () => {
    if (!userId) {
      setCoupons([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/coupons?user_id=${encodeURIComponent(userId)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.success && Array.isArray(data.coupons)) {
        setCoupons(data.coupons as Coupon[])
      } else {
        console.error('[coupon-context] getCoupons unexpected response:', data)
        setCoupons([])
      }
    } catch (err) {
      console.error('[coupon-context] fetchCoupons error:', err)
      setCoupons([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Fetch on mount and when userId changes
  useEffect(() => {
    fetchCoupons()
  }, [fetchCoupons])

  const refresh = useCallback(() => fetchCoupons(), [fetchCoupons])

  // ── POST /api/coupons/redeem ──────────────────────────────────────────────
  // Replaces addCoupon, which only minted — the caller had to spend the points
  // itself first, in a separate request. That pairing is what produced both the
  // rewards page's "แลกคะแนนสำเร็จ แต่ไม่สามารถสร้างคูปองได้" apology and
  // checkout's silent version of it (points taken, no coupon, no message).
  //
  // The server now prices, spends and mints in one call, so there is no longer
  // an ordering for a caller to get wrong. Prices are NOT sent: the request says
  // what and how many, the catalog says how much.
  const redeemRewards = useCallback(
    async (params: RedeemParams): Promise<RedeemResult> => {
      if (!userId) {
        throw new Error('ไม่พบข้อมูลผู้ใช้ LINE กรุณาเข้าสู่ระบบผ่าน LINE อีกครั้ง')
      }

      const response = await fetch('/api/coupons/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // One key per press, so a retry replays instead of double-charging.
          'Idempotency-Key': newIdempotencyKey(),
        },
        body: JSON.stringify({
          user_id: userId,
          items: params.items,
          redeem_type: params.redeem_type ?? 'pickup',
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'ไม่สามารถแลกของรางวัลได้')
      }

      const minted: Coupon[] = data.coupons ?? (data.coupon ? [data.coupon] : [])
      setCoupons((prev) => [...minted, ...prev])

      return { coupons: minted, tx_id: data.tx_id, points_used: data.points_used }
    },
    [userId]
  )

  // ── GET /api/coupons/[id] ─────────────────────────────────────────────────
  const getCoupon = useCallback(
    async (coupon_id: string): Promise<Coupon | undefined> => {
      // Check local cache first for instant response
      const cached = coupons.find((c) => c.coupon_id === coupon_id)
      if (cached) return cached

      try {
        // Bearer token: /api/coupons/[id] is owner-or-admin now.
        const res = await apiFetch(`/api/coupons/${encodeURIComponent(coupon_id)}`)
        if (res.status === 404) return undefined
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (data.success && data.coupon) {
          const coupon = data.coupon as Coupon
          // Merge into local state
          setCoupons((prev) => {
            const exists = prev.find((c) => c.coupon_id === coupon_id)
            return exists ? prev.map((c) => (c.coupon_id === coupon_id ? coupon : c)) : [coupon, ...prev]
          })
          return coupon
        }
        return undefined
      } catch (err) {
        console.error('[coupon-context] getCoupon error:', err)
        return undefined
      }
    },
    [coupons]
  )

  // ── POST /api/coupons/use ─────────────────────────────────────────────────
  const markUsed = useCallback(
    async (coupon_id: string, scanned_by?: string): Promise<void> => {
      // scanned_by is ignored by the server now — it comes from the admin
      // session, so the audit column records who actually scanned rather than
      // whoever the client claimed.
      const response = await apiFetch('/api/coupons/use', {
        method: 'POST',
        body: JSON.stringify({ coupon_id, scanned_by: scanned_by ?? '' }),
      })

      // Read once: response.json() consumes the body, and the old code called
      // it again in the error branch, which throws before the real message.
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to mark coupon as used')
      }

      const updated: Coupon = data.coupon

      // Update local state immediately
      setCoupons((prev) =>
        prev.map((c) => (c.coupon_id === coupon_id ? { ...c, ...updated } : c))
      );
    },
    []
  )

  return (
    <CouponContext.Provider value={{ coupons, loading, redeemRewards, getCoupon, markUsed, refresh }}>
      {children}
    </CouponContext.Provider>
  )
}

export function useCoupons() {
  const ctx = useContext(CouponContext)
  if (ctx === undefined) {
    throw new Error('useCoupons must be used within a CouponProvider')
  }
  return ctx
}