'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import liff from '@line/liff'

import { setLiffSdkReady } from '@/lib/api-client'
import { isIdTokenExpired } from '@/lib/line-id-token'
import { checkSession, endSession, needsRelogin } from '@/lib/session-client'

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

/** Bounds the session re-login to one redirect per browser-tab session. */
const ID_TOKEN_RELOGIN_FLAG = 'liff_id_token_relogin'

/** Resume events come in pairs and on every app switch; check at most this often. */
const RESUME_CHECK_INTERVAL_MS = 60_000

/**
 * The LINE user LIFF is signed in as, read from what LIFF already holds — so
 * it answers even after the ID token itself has expired.
 */
function liffUserId(): string | null {
  try {
    return liff.getDecodedIDToken()?.sub ?? liff.getContext()?.userId ?? null
  } catch {
    return null
  }
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

  // "liff.init() resolved, so SDK calls are safe" — deliberately NOT the same as
  // `isReady`, which only means "the hook has finished trying". They diverge
  // while liff.init() is still in flight, and permanently if NEXT_PUBLIC_LIFF_ID
  // is missing (a real misconfiguration now, not a supported mode) — either way,
  // calling an SDK method before init resolves throws
  // `liffId is necessary for liff.init()`. Guarding on readiness alone let that
  // throw on every getIDToken() — caught and logged, but noisy and misleading.
  //
  // A ref rather than state because the useCallbacks below have empty dep arrays
  // and would otherwise close over the initial `false`. That is also why these
  // guards can't read `liff.isReady`: the SDK does not define it, so the
  // expression was always undefined and getIDToken/getAccessToken always
  // returned null, login/logout were no-ops, and scanCode always threw.
  // `typescript.ignoreBuildErrors` hid all of it.
  const sdkReadyRef = useRef(false)

  const markReady = useCallback(() => {
    setIsReady(true)
  }, [])

  /**
   * Makes sure the server has a session for the LINE user LIFF is signed in
   * as, sending the user through LINE for a fresh ID token only when it has
   * not.
   *
   * GET /api/session answers from whichever credential it has. With a fresh ID
   * token attached (apiFetch adds it) that call is also what creates or
   * refreshes the session cookie. Once the token's hour is up the cookie
   * carries on alone — which is the point: this redirect used to happen every
   * time the token died, and now happens only when the session has died too
   * (twelve idle hours, or seven days since LINE last vouched) or belongs to a
   * different LINE account.
   *
   * liff.login() navigates, so this runs only at startup and on resume, never
   * mid-action. Bounded by a sessionStorage flag: if there is still no session
   * after coming back — a wrong LINE_CHANNEL_ID, a badly skewed device clock —
   * the user gets a 401 to look at instead of an endless bounce through LINE.
   *
   * @returns true when a redirect has been started and the page is leaving.
   */
  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (!sdkReadyRef.current) return false

    try {
      if (!liff.isLoggedIn()) return false

      const check = await checkSession()
      if (!needsRelogin(check, liffUserId())) {
        if (check.status === 'active') {
          try { sessionStorage.removeItem(ID_TOKEN_RELOGIN_FLAG) } catch {}
        }
        return false
      }

      if (sessionStorage.getItem(ID_TOKEN_RELOGIN_FLAG)) {
        console.warn('[LIFF] Still no usable session after re-login — not redirecting again.')
        return false
      }

      console.info('[LIFF] No usable session for this LINE user — re-logging in.')
      sessionStorage.setItem(ID_TOKEN_RELOGIN_FLAG, '1')
      liff.login({ redirectUri: window.location.href })
      return true
    } catch (err) {
      console.error('[LIFF] Session check failed:', err)
      return false
    }
  }, [])

  // A resumed webview is the case that matters: the app sits backgrounded past
  // the ID token's hour and the user taps back in. Nothing needs doing while
  // the token is fresh — every request carries it and keeps the session topped
  // up. Once it has died the session is the only credential left, so check it
  // is still there before the user starts something. Both events fire on
  // resume (visibilitychange in the LINE client, pageshow on a bfcache
  // restore); the interval keeps the pair, and rapid app switching, to one
  // request.
  const lastResumeCheckRef = useRef(0)

  useEffect(() => {
    const onResume = () => {
      if (document.visibilityState === 'hidden' || !sdkReadyRef.current) return

      try {
        if (!isIdTokenExpired(liff.getIDToken())) return
      } catch {
        return
      }

      const now = Date.now()
      if (now - lastResumeCheckRef.current < RESUME_CHECK_INTERVAL_MS) return
      lastResumeCheckRef.current = now

      void ensureSession()
    }

    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('pageshow', onResume)

    return () => {
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('pageshow', onResume)
    }
  }, [ensureSession])

  useEffect(() => {
    const initLiff = async () => {
      try {
        // Use environment variable or provided liffId
        const id = liffId || process.env.NEXT_PUBLIC_LIFF_ID

        if (!id) {
          // A real misconfiguration, not a supported "demo mode" — there is no
          // fake identity to fall back to. Every page that needs a LINE user id
          // stays logged-out until this is set.
          console.error('[LIFF] NEXT_PUBLIC_LIFF_ID is not set — LINE login is unavailable.')
          setError('ระบบยังไม่ได้ตั้งค่า LINE Login (NEXT_PUBLIC_LIFF_ID)')
          setLoadingStep('ready')
          markReady()
          return
        }

        setLoadingStep('initializing')
        await liff.init({ liffId: id })
        sdkReadyRef.current = true
        setLiffSdkReady(true)
        setIsInClient(liff.isInClient())
        setOs(liff.getOS() ?? null)
        setLanguage(liff.getLanguage())
        setLineVersion(liff.getLineVersion())

        // Not logged in — redirect to LINE login and come back to the same URL.
        // Using window.location.href as redirectUri ensures the user lands back
        // on whatever page they were on (e.g. /home, /profile-view/xxx, etc.)
        // on both desktop and mobile browsers.
        //
        // Do NOT hardcode a path here (this was '/register' and caused a bug).
        // The LIFF session token lives in localStorage, so clearing site data —
        // or opening the app on a new device — logs the user out and sends them
        // through here. Landing them on /register skips '/', which is what
        // decides register-vs-home (cache first, then the profile API), so
        // already-registered users were shown the registration form again.
        if (!liff.isLoggedIn()) {
          setLoadingStep('requesting_permission')
          liff.login({ redirectUri: window.location.href })
          return
        }

        // Fetch profile and set all auth state atomically so consumers never
        // see isLoggedIn=true with profile=null.
        setLoadingStep('fetching_profile')

        // The session check runs alongside the profile fetch — neither needs
        // the other, so it adds no time to startup. It must finish before any
        // page mounts (markReady below): with a fresh ID token it is what
        // creates the session cookie, and with a dead one it decides whether
        // the cookie can carry on or LINE has to mint a new token. Pages
        // opened straight from a URL — like /profile-view/[id] from a staff
        // QR scan — go through this too; LiffProvider wraps every page.
        type ProfileAttempt = { ok: true; profile: LiffProfile } | { ok: false; error: unknown }
        const profileAttempt: Promise<ProfileAttempt> = liff.getProfile().then(
          (profile) => ({ ok: true as const, profile }),
          (error: unknown) => ({ ok: false as const, error }),
        )

        if (await ensureSession()) {
          setLoadingStep('requesting_permission')
          return
        }

        const attempt = await profileAttempt
        let userProfile: LiffProfile | null = null
        if (attempt.ok) {
          userProfile = attempt.profile
        } else {
          const profileErr = attempt.error
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
        markReady()
      } catch (err) {
        console.error('[LIFF] Initialization failed:', err)
        setError(err instanceof Error ? err.message : 'LIFF initialization failed')
        setLoadingStep('ready')
        markReady() // Still mark as ready for fallback
      }
    }

    initLiff()
  }, [liffId, ensureSession])

  const login = useCallback(() => {
    try {
      if (sdkReadyRef.current && !liff.isLoggedIn()) {
        liff.login()
      }
    } catch (err) {
      console.error('[LIFF] Login failed:', err)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      if (sdkReadyRef.current && liff.isLoggedIn()) {
        // End our session as well as LIFF's; otherwise the cookie would keep
        // this browser signed in to the API for up to twelve more hours.
        await endSession()
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
      if (sdkReadyRef.current && liff.isInClient()) {
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
      if (sdkReadyRef.current && liff.isInClient()) {
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
      if (!sdkReadyRef.current) {
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
      if (sdkReadyRef.current && liff.isInClient()) {
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
      if (sdkReadyRef.current && liff.isLoggedIn()) {
        return liff.getAccessToken()
      }
      return null
    } catch (err) {
      console.error('[LIFF] Failed to get access token:', err)
      return null
    }
  }, [])

  /**
   * An ID token the server will actually accept, or null.
   *
   * isLoggedIn() is true for the whole 12-hour session, but the token itself
   * lives one hour, so this cannot just hand back whatever getIDToken() returns
   * — that is what put a ten-hour-old token in an Authorization header and got
   * a 401 back on an upload the user had just started.
   */
  const getIDToken = useCallback((): string | null => {
    try {
      if (sdkReadyRef.current && liff.isLoggedIn()) {
        const token = liff.getIDToken()
        return isIdTokenExpired(token) ? null : token
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
