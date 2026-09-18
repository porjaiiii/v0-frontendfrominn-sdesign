'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { MOCK_USER } from '@/lib/mock-user'
import type { WasteRate, WasteRates, WasteType } from '@/lib/rates'

export type { WasteType }

export interface WasteSubType {
  id: string
  name: string
  description?: string
  image: string
}

export interface UserProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  totalCarbon: number
  totalPoints: number
  rank: number
}

interface AppContextType {
  // User data — kept in sync with the real LIFF profile by lib/liff-context.tsx.
  userProfile: UserProfile | null
  setUserProfile: (profile: UserProfile | null) => void

  // Live waste rates (Phase 7), replacing the CARBON_FACTORS/POINTS_PER_KG
  // table that used to be copy-pasted into app/home/page.tsx,
  // components/waste-detail-modal.tsx and both waste API routes.
  //
  // Fetched once per session from GET /api/catalog/waste-types. Starts as
  // lib/rates.ts's offline fallback, which stays in place if the fetch never
  // resolves — a slow or failed catalog fetch must never block the submission
  // flow, since these numbers are only an estimate (the real price is set
  // server-side, inside submit_waste/confirm_waste).
  /** null until GET /api/catalog/waste-types answers, and if it never does. */
  wasteRates: WasteRates
  wasteRatesLoading: boolean
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>({
    userId: MOCK_USER.lineUserId,
    displayName: MOCK_USER.displayName,
    totalCarbon: MOCK_USER.carbon,
    totalPoints: MOCK_USER.points,
    rank: 0,
  })

  // Starts null, not with a hardcoded copy of app.waste_types. Screens render
  // "—" until the real rates arrive; an estimate that disagrees with what the
  // server will award is worse than no estimate.
  const [wasteRates, setWasteRates] = useState<WasteRates>(null)
  const [wasteRatesLoading, setWasteRatesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetch('/api/catalog/waste-types')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.success || !Array.isArray(data.wasteTypes)) return

        const next: Record<string, WasteRate> = {}
        for (const entry of data.wasteTypes) {
          if (typeof entry?.id !== 'string') continue
          const carbonFactor = Number(entry.carbonFactor)
          const pointsPerKg = Number(entry.pointsPerKg)
          // A row we cannot read is skipped, not substituted: carbonFactorFor()
          // reports the missing rate as null and the screen shows "—".
          if (!Number.isFinite(carbonFactor) || !Number.isFinite(pointsPerKg)) continue

          next[entry.id] = { carbonFactor, pointsPerKg }
        }
        // Merged over what this session already has, so a partial response
        // cannot blank out a rate that was already known.
        if (Object.keys(next).length > 0) {
          setWasteRates((prev) => ({ ...(prev ?? {}), ...next }))
        }
      })
      .catch((err) => {
        // Network failure — rates stay null and the screens show "—". The
        // submission itself is unaffected; the server prices it either way.
        console.error('[app-context] waste-types catalog fetch failed:', err)
      })
      .finally(() => {
        if (!cancelled) setWasteRatesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AppContext.Provider value={{ userProfile, setUserProfile, wasteRates, wasteRatesLoading }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
