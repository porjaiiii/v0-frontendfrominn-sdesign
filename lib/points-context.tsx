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
import { MOCK_USER } from './mock-user'

export interface PointsAccount {
  user_id: string
  total_points: number
  total_weight: number
  total_co2: number
  tier: string
  last_updated?: string
}

interface SpendResult {
  success: boolean
  message?: string
  tx_id?: string
}

/** One line item recorded against a spend (reward purchase or donation). */
export interface SpendItem {
  name: string
  quantity: number
  points: number
}

/** Extra detail logged to the spend_details sheet, grouped under one tx_id. */
export interface SpendDetail {
  category: 'reward' | 'donate'
  items: SpendItem[]
}

interface PointsContextType {
  /** The LINE user id backing this account, or null before LIFF has a profile. */
  userId: string | null
  points: number
  carbon: number
  weight: number
  tier: string
  loading: boolean
  error: string | null
  /** true when the values come from the real points DB, false for mock/demo. */
  isReal: boolean
  /** Re-fetch the account balance from the sheet. */
  refresh: () => Promise<void>
  /**
   * Spend points (FIFO) via the Apps Script, then refresh the balance.
   * Optionally pass `detail` to record what was bought/donated against the
   * transaction id in the spend_details sheet.
   */
  spendPoints: (amount: number, detail?: SpendDetail) => Promise<SpendResult>
}

const PointsContext = createContext<PointsContextType | undefined>(undefined)

export function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

// Points are always whole numbers; weight/CO2 are shown to 2 decimals. Rounding
// here strips floating-point artifacts (e.g. 829.9999999999 / 2.30000000004)
// that can sneak in from the sheet sums or Apps Script before they hit the UI.
export function toPoints(value: unknown): number {
  return Math.round(toNumber(value))
}
export function toMetric(value: unknown): number {
  return Math.round(toNumber(value) * 100) / 100
}

export function PointsProvider({ children }: { children: ReactNode }) {
  const { profile, isReady } = useLiffContext()
  const userId = profile?.userId ?? null

  const [account, setAccount] = useState<PointsAccount | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load the balance.
  //
  // This used to be three sequential POSTs: a fast read of the public points
  // sheet, then get_or_create_account against Apps Script, then resync_balance
  // to repair the drift between points_account.total_points and what was
  // actually spendable. On Postgres the balance is DERIVED (app.v_user_balances)
  // rather than stored, so there is no drift to repair and nothing to create
  // before a user has points — the last two calls became no-ops that still cost
  // a round trip each on every page load.
  //
  // It also fixes a real bug in that chain: a registered user with no waste yet
  // fell through the fast read's `notFound` into get_or_create_account, which
  // answered `success:false`, and the UI showed "ไม่สามารถโหลดคะแนนได้" instead
  // of a zero balance.
  const loadAccount = useCallback(async (uid: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/points?action=get_account_fast&user_id=${encodeURIComponent(uid)}`,
        { cache: 'no-store' }
      )
      const data = await res.json()

      if (data?.success && data.account) {
        setAccount({
          user_id: data.account.user_id,
          total_points: toPoints(data.account.total_points),
          total_weight: toMetric(data.account.total_weight),
          total_co2: toMetric(data.account.total_co2),
          tier: data.account.tier ?? '',
          last_updated: data.account.last_updated,
        })
        return
      }

      if (data?.notFound) {
        // Registered, but has never recycled. That is a zero balance, not an
        // error — showing an error here is what sent new users to a dead end.
        setAccount({
          user_id: uid,
          total_points: 0,
          total_weight: 0,
          total_co2: 0,
          tier: '',
          last_updated: undefined,
        })
        return
      }

      setError(data?.message || 'ไม่สามารถโหลดคะแนนได้')
    } catch (err) {
      console.error('[points-context] loadAccount failed:', err)
      setError('ไม่สามารถเชื่อมต่อระบบคะแนนได้')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto get-or-create the account once LIFF is ready and we have a user id.
  useEffect(() => {
    if (isReady && userId) {
      loadAccount(userId)
    }
  }, [isReady, userId, loadAccount])

  const refresh = useCallback(async () => {
    if (userId) await loadAccount(userId)
  }, [userId, loadAccount])

  const spendPoints = useCallback(
    async (amount: number, detail?: SpendDetail): Promise<SpendResult> => {
      if (!userId) return { success: false, message: 'ไม่พบบัญชีผู้ใช้ (กรุณาเข้าสู่ระบบผ่าน LINE)' }
      if (!amount || amount <= 0) return { success: false, message: 'จำนวนคะแนนไม่ถูกต้อง' }
      try {
        const res = await fetch('/api/points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'spend_points',
            user_id: userId,
            points: amount,
            category: detail?.category,
            items: detail?.items,
          }),
        })
        const data = await res.json()
        if (data?.success) {
          await loadAccount(userId) // resync balance after spending
          return { success: true, tx_id: data.tx_id }
        }
        return { success: false, message: data?.message || 'ไม่สามารถใช้คะแนนได้' }
      } catch (err) {
        console.error('[points-context] spendPoints failed:', err)
        return { success: false, message: 'ไม่สามารถเชื่อมต่อระบบคะแนนได้' }
      }
    },
    [userId, loadAccount]
  )

  const isReal = Boolean(userId && account)

  const value: PointsContextType = {
    userId,
    // Before there's a real LIFF user, fall back to the mock figures so the UI still renders.
    points: account ? account.total_points : userId ? 0 : MOCK_USER.points,
    carbon: account ? account.total_co2 : userId ? 0 : MOCK_USER.carbon,
    weight: account ? account.total_weight : 0,
    tier: account?.tier ?? '',
    loading,
    error,
    isReal,
    refresh,
    spendPoints,
  }

  return <PointsContext.Provider value={value}>{children}</PointsContext.Provider>
}

export function usePoints() {
  const ctx = useContext(PointsContext)
  if (ctx === undefined) {
    throw new Error('usePoints must be used within a PointsProvider')
  }
  return ctx
}
