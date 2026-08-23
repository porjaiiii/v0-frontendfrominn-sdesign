'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { MOCK_USER } from '@/lib/mock-user'
import { WASTE_RATES, type WasteRate, type WasteType } from '@/lib/rates'

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
  wasteRates: Record<WasteType, WasteRate>
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

  const [wasteRates, setWasteRates] = useState<Record<WasteType, WasteRate>>(WASTE_RATES)
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
          next[entry.id] = {
            carbonFactor: Number(entry.carbonFactor) || WASTE_RATES.plastic.carbonFactor,
            pointsPerKg: Number(entry.pointsPerKg) || WASTE_RATES.plastic.pointsPerKg,
          }
        }
        // Merge over the fallback rather than replacing it outright, so a
        // partial or unexpected response can't blank out a rate this session
        // already had a value for.
        if (Object.keys(next).length > 0) {
          setWasteRates((prev) => ({ ...prev, ...next } as Record<WasteType, WasteRate>))
        }
      })
      .catch((err) => {
        // Network failure — the fallback set at useState init is already on
        // screen, so there's nothing more to do here.
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
