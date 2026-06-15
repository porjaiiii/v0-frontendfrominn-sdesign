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
 * Database fields design (for future backend integration):
 *
 * TABLE: coupons
 * ─────────────────────────────────────────────────────
 * coupon_id       UUID / string   PK — also the QR code payload
 * user_id         string          LINE user ID of the coupon owner
 * reward_id       number          Reference to REWARDS list
 * reward_name     string          Snapshot of reward name at redemption time
 * reward_description string       Snapshot of reward description
 * reward_image    string          Path to reward image
 * points_used     number          Points spent to redeem
 * tx_id           string          Reference to points transaction ID
 * status          enum            'active' | 'used' | 'expired'
 * redeemed_at     timestamp       When the coupon was created
 * used_at         timestamp       When the coupon was scanned/used (nullable)
 * expires_at      timestamp       Expiry date (nullable, optional)
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
  redeemed_at: string // ISO datetime string
  used_at?: string
  expires_at?: string
}

interface CouponContextType {
  coupons: Coupon[]
  loading: boolean
  /** Create a coupon after a successful reward redemption */
  addCoupon: (params: {
    reward_id: number
    reward_name: string
    reward_description: string
    reward_image: string
    points_used: number
    tx_id?: string
  }) => Coupon
  /** Get a single coupon by ID */
  getCoupon: (coupon_id: string) => Coupon | undefined
  /** Mark a coupon as used (for future scanner integration) */
  markUsed: (coupon_id: string) => void
}

const CouponContext = createContext<CouponContextType | undefined>(undefined)

function generateCouponId(): string {
  // Format: CPNxxxxxxxx-xxxx-xxxx (easy to read, URL safe)
  const hex = () => Math.random().toString(16).substring(2, 10).toUpperCase()
  return `CPN${hex()}-${hex().substring(0, 4)}-${hex().substring(0, 4)}`
}

function storageKey(userId: string) {
  return `coupons_${userId}`
}

export function CouponProvider({ children }: { children: ReactNode }) {
  const { profile } = useLiffContext()
  const userId = profile?.userId ?? 'demo_user'

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)

  // Load from localStorage on mount / userId change
  useEffect(() => {
    setLoading(true)
    try {
      const raw = localStorage.getItem(storageKey(userId))
      if (raw) {
        setCoupons(JSON.parse(raw) as Coupon[])
      } else {
        setCoupons([])
      }
    } catch {
      setCoupons([])
    }
    setLoading(false)
  }, [userId])

  const persist = useCallback(
    (updated: Coupon[]) => {
      setCoupons(updated)
      try {
        localStorage.setItem(storageKey(userId), JSON.stringify(updated))
      } catch {
        // storage quota exceeded — silently ignore
      }
    },
    [userId]
  )

  const addCoupon = useCallback(
    (params: {
      reward_id: number
      reward_name: string
      reward_description: string
      reward_image: string
      points_used: number
      tx_id?: string
    }): Coupon => {
      const coupon: Coupon = {
        coupon_id: generateCouponId(),
        user_id: userId,
        reward_id: params.reward_id,
        reward_name: params.reward_name,
        reward_description: params.reward_description,
        reward_image: params.reward_image,
        points_used: params.points_used,
        tx_id: params.tx_id,
        status: 'active',
        redeemed_at: new Date().toISOString(),
      }
      persist([coupon, ...coupons])
      return coupon
    },
    [coupons, persist, userId]
  )

  const getCoupon = useCallback(
    (coupon_id: string) => coupons.find((c) => c.coupon_id === coupon_id),
    [coupons]
  )

  const markUsed = useCallback(
    (coupon_id: string) => {
      const updated = coupons.map((c) =>
        c.coupon_id === coupon_id
          ? { ...c, status: 'used' as const, used_at: new Date().toISOString() }
          : c
      )
      persist(updated)
    },
    [coupons, persist]
  )

  return (
    <CouponContext.Provider value={{ coupons, loading, addCoupon, getCoupon, markUsed }}>
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
