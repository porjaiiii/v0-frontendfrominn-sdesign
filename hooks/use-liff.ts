'use client'

import { useEffect, useState, useCallback } from 'react'
import liff from '@line/liff'

export interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

export interface ScanCodeResult {
  value: string | null
}

export type LiffLoadingStep =
  | 'idle'
  | 'initializing'
  | 'requesting_permission'
  | 'fetching_profile'
  | 'ready'

export interface UseLiffReturn {
  // State
  isLoggedIn: boolean
  isReady: boolean
  isInClient: boolean
  profile: LiffProfile | null
  error: string | null
  os: string | null
  language: string | null
  lineVersion: string | null
  loadingStep: LiffLoadingStep
  
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

const LIFF_REDIRECT_KEY = 'liff_intended_path'

export function useLiff(liffId?: string): UseLiffReturn {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [isInClient, setIsInClient] = useState(false)
  const [profile, setProfile] = useState<LiffProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [os, setOs] = useState<string | null>(null)
  const [language, setLanguage] = useState<string | null>(null)
  const [lineVersion, setLineVersion] = useState<string | null>(null)
  const [loadingStep, setLoadingStep] = useState<LiffLoadingStep>('idle')

  useEffect(() => {
    const initLiff = async () => {
      try {
        // Use environment variable or provided liffId
        const id = liffId || process.env.NEXT_PUBLIC_LIFF_ID
        
        if (!id) {
          console.warn('[LIFF] No LIFF ID provided. Running in demo mode.')
          setLoadingStep('ready')
          setIsReady(true)
          return
        }

        setLoadingStep('initializing')
        await liff.init({ liffId: id })
        setIsInClient(liff.isInClient())
        setOs(liff.getOS())
        setLanguage(liff.getLanguage())
        setLineVersion(liff.getLineVersion())

        // Auto-login if not logged in — save current path first so we can
        // restore it after LINE returns the user back to the LIFF app.
        if (!liff.isLoggedIn()) {
          setLoadingStep('requesting_permission')
          // Determine intended path — treat "/" as "/register" because the
          // LIFF entry point always lands on "/" but the real destination is
          // the register page for first-time users.
          const rawPath = window.location.pathname + window.location.search
          const intendedPath = rawPath === '/' ? '/register' : rawPath
          try {
            localStorage.setItem(LIFF_REDIRECT_KEY, intendedPath)
          } catch (_) {
            // localStorage may be unavailable in some environments
          }
          // Always redirect back to the intended path (e.g. /register) after
          // LINE grants permission, not to "/" which is just the LIFF entry.
          const redirectUri = window.location.origin + intendedPath
          liff.login({ redirectUri })
          return
        }

        // User is logged in — check if we need to restore a saved path
        try {
          const savedPath = localStorage.getItem(LIFF_REDIRECT_KEY)
          if (savedPath && savedPath !== '/') {
            localStorage.removeItem(LIFF_REDIRECT_KEY)
            const currentPath = window.location.pathname + window.location.search
            // Only redirect if we're not already on the intended page
            if (currentPath !== savedPath) {
              window.location.replace(savedPath)
              return
            }
          }
        } catch (_) {
          // localStorage unavailable — skip path restoration
        }

        // Fetch profile
        setLoadingStep('fetching_profile')
        setIsLoggedIn(true)
        try {
          const userProfile = await liff.getProfile()
          setProfile(userProfile)
        } catch (profileErr) {
          console.error('[LIFF] Failed to get profile:', profileErr)
        }

        setLoadingStep('ready')
        setIsReady(true)
      } catch (err) {
        console.error('[LIFF] Initialization failed:', err)
        setError(err instanceof Error ? err.message : 'LIFF initialization failed')
        setLoadingStep('ready')
        setIsReady(true) // Still mark as ready for fallback
      }
    }

    initLiff()
  }, [liffId])

  const login = useCallback(() => {
    try {
      if (liff.isReady && !liff.isLoggedIn()) {
        liff.login()
      }
    } catch (err) {
      console.error('[LIFF] Login failed:', err)
    }
  }, [])

  const logout = useCallback(() => {
    try {
      if (liff.isReady && liff.isLoggedIn()) {
        liff.logout()
        setIsLoggedIn(false)
        setProfile(null)
        window.location.reload()
      }
    } catch (err) {
      console.error('[LIFF] Logout failed:', err)
    }
  }, [])

  const sendMessage = useCallback(async (message: string) => {
    try {
      if (liff.isInClient()) {
        await liff.sendMessages([
          {
            type: 'text',
            text: message
          }
        ])
      } else {
        console.warn('[LIFF] sendMessage is only available in LINE app')
      }
    } catch (err) {
      console.error('[LIFF] Failed to send message:', err)
      throw err
    }
  }, [])

  const closeWindow = useCallback(() => {
    try {
      if (liff.isInClient()) {
        liff.closeWindow()
      } else {
        window.close()
      }
    } catch (err) {
      console.error('[LIFF] Failed to close window:', err)
    }
  }, [])

  const scanCode = useCallback(async (): Promise<ScanCodeResult> => {
    try {
      if (!liff.isReady) {
        throw new Error('LIFF ยังไม่พร้อม โปรดรอสักครู่')
      }
      
      if (!liff.isInClient()) {
        throw new Error('ฟีเจอร์สแกน QR Code ใช้งานได้เฉพาะในแอป LINE เท่านั้น')
      }
      
      console.log('[LIFF] Starting QR scan...')
      
      // Check if scanCodeV2 is available (requires LIFF 2.15.0+)
      if (liff.scanCodeV2) {
        console.log('[LIFF] Using scanCodeV2')
        const result = await liff.scanCodeV2()
        console.log('[LIFF] Scan result:', result.value)
        return { value: result.value || null }
      } else if (liff.scanCode) {
        // Fallback to legacy scanCode
        console.log('[LIFF] Using legacy scanCode')
        const result = await liff.scanCode()
        console.log('[LIFF] Scan result:', result.value)
        return { value: result.value || null }
      } else {
        throw new Error('ไม่พบฟีเจอร์สแกน QR Code ในเวอร์ชันนี้ของ LINE')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ไม่สามารถเปิดกล้องสแกน QR Code ได้'
      console.error('[LIFF] Failed to scan code:', err)
      throw new Error(errorMessage)
    }
  }, [])

  const openExternalBrowser = useCallback((url: string) => {
    try {
      if (liff.isInClient()) {
        liff.openWindow({
          url,
          external: true
        })
      } else {
        window.open(url, '_blank')
      }
    } catch (err) {
      console.error('[LIFF] Failed to open external browser:', err)
      window.open(url, '_blank')
    }
  }, [])

  const getAccessToken = useCallback((): string | null => {
    try {
      if (liff.isReady && liff.isLoggedIn()) {
        return liff.getAccessToken()
      }
      return null
    } catch (err) {
      console.error('[LIFF] Failed to get access token:', err)
      return null
    }
  }, [])

  const getIDToken = useCallback((): string | null => {
    try {
      if (liff.isReady && liff.isLoggedIn()) {
        return liff.getIDToken()
      }
      return null
    } catch (err) {
      console.error('[LIFF] Failed to get ID token:', err)
      return null
    }
  }, [])

  return {
    isLoggedIn,
    isReady,
    isInClient,
    profile,
    error,
    os,
    language,
    lineVersion,
    loadingStep,
    login,
    logout,
    sendMessage,
    closeWindow,
    scanCode,
    openExternalBrowser,
    getAccessToken,
    getIDToken
  }
}
