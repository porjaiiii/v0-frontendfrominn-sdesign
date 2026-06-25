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
  /** The LINE user id backing this account, or null in demo mode (no LIFF). */
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

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

// Points are always whole numbers; weight/CO2 are shown to 2 decimals. Rounding
// here strips floating-point artifacts (e.g. 829.9999999999 / 2.30000000004)
// that can sneak in from the sheet sums or Apps Script before they hit the UI.
function toPoints(value: unknown): number {
  return Math.round(toNumber(value))
}
function toMetric(value: unknown): number {
  return Math.round(toNumber(value) * 100) / 100
}

export function PointsProvider({ children }: { children: ReactNode }) {
  const { profile, isReady } = useLiffContext()
  const userId = profile?.userId ?? null

  const [account, setAccount] = useState<PointsAccount | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ensure the account exists (creates it on first login) and load the balance.
  const loadAccount = useCallback(async (uid: string) => {
    setLoading(true)
    setError(null)
    try {
      // ── Fast path: read the balance straight from the public points sheet ──
      // No Apps Script cold start. Returns notFound for brand-new users, who
      // then fall through to the GAS path below so their account gets created.
      try {
        const fastRes = await fetch(
          `/api/points?action=get_account_fast&user_id=${encodeURIComponent(uid)}`
        )
        const fast = await fastRes.json()
        if (fast?.success && fast.account) {
          setAccount({
            user_id: fast.account.user_id,
            total_points: toPoints(fast.account.total_points),
            total_weight: toMetric(fast.account.total_weight),
            total_co2: toMetric(fast.account.total_co2),
            tier: fast.account.tier ?? '',
            last_updated: fast.account.last_updated,
          })
          return
        }
      } catch {
        // Fast read failed — fall through to the authoritative GAS path.
      }

      // ── Fallback: Apps Script get_or_create (handles new-user creation) ──
      const res = await fetch('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_or_create_account', user_id: uid }),
      })
      const data = await res.json()
      if (data?.success && data.account) {
        // The account's total_points can drift from the actual spendable balance
        // in points_monthly (e.g. hand-edited cells). Resync so the number shown
        // == the number that can actually be spent. Otherwise the UI shows
        // "enough points" but the server rejects the spend as "Not enough points".
        let spendablePoints = toPoints(data.account.total_points)
        try {
          const syncRes = await fetch('/api/points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'resync_balance', user_id: uid }),
          })
          const syncData = await syncRes.json()
          if (syncData?.success) spendablePoints = toPoints(syncData.total_points)
        } catch {
          // Resync failed — fall back to the account's stored total.
        }

        setAccount({
          user_id: data.account.user_id,
          total_points: spendablePoints,
          total_weight: toMetric(data.account.total_weight),
          total_co2: toMetric(data.account.total_co2),
          tier: data.account.tier ?? '',
          last_updated: data.account.last_updated,
        })
      } else {
        setError(data?.message || 'ไม่สามารถโหลดคะแนนได้')
      }
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
    // In demo mode (no LIFF user) fall back to the mock figures so the UI still renders.
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
