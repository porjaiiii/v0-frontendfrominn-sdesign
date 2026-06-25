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

  useEffect(() => {
    const initLiff = async () => {
      try {
        // Use environment variable or provided liffId
        const id = liffId || process.env.NEXT_PUBLIC_LIFF_ID
        
        if (!id) {
          console.warn('[LIFF] No LIFF ID provided. Running in demo mode.')
          setIsReady(true)
          return
        }
        
        await liff.init({ liffId: id })
        setIsInClient(liff.isInClient())
        setOs(liff.getOS())
        setLanguage(liff.getLanguage())
        setLineVersion(liff.getLineVersion())

        // Auto-login if not logged in
        if (!liff.isLoggedIn()) {
          // Redirect to LINE login automatically
          liff.login()
          return
        }

        // User is logged in, get profile
        setIsLoggedIn(true)
        try {
          const userProfile = await liff.getProfile()
          setProfile(userProfile)
        } catch (profileErr) {
          console.error('[LIFF] Failed to get profile:', profileErr)
        }
        
        setIsReady(true)
      } catch (err) {
        console.error('[LIFF] Initialization failed:', err)
        setError(err instanceof Error ? err.message : 'LIFF initialization failed')
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
