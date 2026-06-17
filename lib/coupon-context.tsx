'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useLiffContext } from './liff-context'

/**
 * Database fields design:
 *
 * TABLE: coupons
 * ─────────────────────────────────────────────────────
 * coupon_id          string   PK — also the QR code payload
 * user_id            string   LINE user ID of the coupon owner
 * reward_id          number   Reference to REWARDS list
 * reward_name        string   Snapshot of reward name at redemption time
 * reward_description string   Snapshot of reward description
 * reward_image       string   Path to reward image
 * points_used        number   Points spent to redeem
 * tx_id              string   Reference to points transaction ID
 * status             enum     'active' | 'used' | 'expired'
 * redeemed_at        string   ISO — when the coupon was created
 * used_at            string   ISO — when the coupon was scanned/used (nullable)
 * expires_at         string   ISO — expiry date (nullable, optional)
 * scanned_by         string   staff ID that scanned (nullable)
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
  status: 'active' | 'used' | 'expired'
  redeemed_at: string
  used_at?: string
  expires_at?: string
  scanned_by?: string
}

interface CouponContextType {
  coupons: Coupon[]
  loading: boolean
  /** Create a coupon after a successful reward redemption — POST /api/coupons/redeem */
  addCoupon: (params: {
    reward_id: number
    reward_name: string
    reward_description: string
    reward_image: string
    points_used: number
    tx_id?: string
  }) => Promise<Coupon>
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
  const userId = profile?.userId ?? 'demo_user'

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)

  // ── Fetch coupon list from backend: GET /api/coupons?user_id=xxx ──────────
  const fetchCoupons = useCallback(async () => {
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
  const addCoupon = useCallback(
    async (params: {
      reward_id: number
      reward_name: string
      reward_description: string
      reward_image: string
      points_used: number
      tx_id?: string
    }): Promise<Coupon> => {
      const response = await fetch('/api/coupons/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          reward_id: params.reward_id,
          reward_name: params.reward_name,
          reward_description: params.reward_description,
          reward_image: params.reward_image,
          points_used: params.points_used,
          tx_id: params.tx_id ?? '',
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error ?? 'Failed to create coupon')
      }

      const data = await response.json()
      const coupon: Coupon = data.coupon

      // Optimistically prepend to local state so UI updates immediately
      setCoupons((prev) => [coupon, ...prev])
      return coupon
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
        const res = await fetch(`/api/coupons/${encodeURIComponent(coupon_id)}`)
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
      const response = await fetch('/api/coupons/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon_id, scanned_by: scanned_by ?? '' }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error ?? 'Failed to mark coupon as used')
      }

      const data = await response.json()
      const updated: Coupon = data.coupon

      // Update local state immediately
      setCoupons((prev) =>
        prev.map((c) => (c.coupon_id === coupon_id ? { ...c, ...updated } : c))
      )
    },
    []
  )

  return (
    <CouponContext.Provider value={{ coupons, loading, addCoupon, getCoupon, markUsed, refresh }}>
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
