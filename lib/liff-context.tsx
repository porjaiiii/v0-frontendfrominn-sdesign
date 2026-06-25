'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useLiff, type LiffProfile, type ScanCodeResult } from '@/hooks/use-liff'
import { useApp } from './app-context'

interface LiffContextType {
  // State
  isLoggedIn: boolean
  isReady: boolean
  isInClient: boolean
  profile: LiffProfile | null
  error: string | null
  os: string | null
  language: string | null
  lineVersion: string | null
  
  // Auth
  login: () => void
  logout: () => void
  
  // Features
  sendMessage: (message: string) => Promise<void>
  closeWindow: () => void
  scanCode: () => Promise<ScanCodeResult>
  openExternalBrowser: (url: string) => void
  getAccessToken: () => string | null
  getIDToken: () => string | null
}

const LiffContext = createContext<LiffContextType | undefined>(undefined)

export function LiffProvider({ children }: { children: ReactNode }) {
  const liff = useLiff()
  const { setUserProfile } = useApp()

  // Sync LINE profile with app user profile
  useEffect(() => {
    if (liff.isReady && liff.isLoggedIn && liff.profile) {
      setUserProfile({
        userId: liff.profile.userId,
        displayName: liff.profile.displayName,
        pictureUrl: liff.profile.pictureUrl,
        totalCarbon: 0,
        totalPoints: 0,
        rank: 0,
        submissions: []
      })
    }
  }, [liff.isReady, liff.isLoggedIn, liff.profile, setUserProfile])

  return (
    <LiffContext.Provider value={liff}>
      {children}
    </LiffContext.Provider>
  )
}

export function useLiffContext() {
  const context = useContext(LiffContext)
  if (context === undefined) {
    throw new Error('useLiffContext must be used within a LiffProvider')
  }
  return context
}
