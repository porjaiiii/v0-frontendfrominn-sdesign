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

        // Not logged in — redirect to LINE login and come back to the same URL.
        // Using window.location.href as redirectUri ensures the user lands back
        // on whatever page they were on (e.g. /home, /profile-view/xxx, etc.)
        // on both desktop and mobile browsers.
        if (!liff.isLoggedIn()) {
          setLoadingStep('requesting_permission')
          liff.login({ redirectUri: window.location.href })
          return
        }

        // Fetch profile and set all auth state atomically so consumers never
        // see isLoggedIn=true with profile=null.
        setLoadingStep('fetching_profile')
        let userProfile: LiffProfile | null = null
        try {
          userProfile = await liff.getProfile()
        } catch (profileErr) {
          // isLoggedIn() can return true off a LINE access token that has
          // actually expired, which makes getProfile() throw (401). That would
          // leave the app stuck as a "guest" with no data — and because the
          // stale token lives in localStorage, clearing the HTTP cache doesn't
          // help (the failure is browser-specific). Recover by clearing the
          // session and re-logging in to mint a fresh token. A sessionStorage
          // flag bounds this to a single retry so a genuinely broken setup
          // (e.g. missing "profile" scope) can't cause an infinite redirect.
          console.error('[LIFF] Failed to get profile — session may be stale:', profileErr)
          const RELOGIN_FLAG = 'liff_stale_relogin'
          if (!sessionStorage.getItem(RELOGIN_FLAG)) {
            sessionStorage.setItem(RELOGIN_FLAG, '1')
            try { liff.logout() } catch {}
            liff.login({ redirectUri: window.location.href })
            return
          }
        }

        // Healthy session — clear the retry guard so a future stale token can
        // trigger the recovery again.
        if (userProfile) {
          try { sessionStorage.removeItem('liff_stale_relogin') } catch {}
        }

        setIsLoggedIn(true)
        setProfile(userProfile)
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
