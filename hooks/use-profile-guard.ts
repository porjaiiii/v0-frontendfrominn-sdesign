'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiffContext } from '@/lib/liff-context'

type GuardStatus = 'loading' | 'ok' | 'redirecting'

// How long (ms) to wait for the profile API before giving up and failing open.
// Google Apps Script can be slow on cold starts — set generously.
const FETCH_TIMEOUT_MS = 10_000

/**
 * Checks whether the current LINE user has a completed registration profile.
 * Redirects to /register ONLY when the API explicitly returns 404.
 * Any other error (timeout, 5xx, network failure) fails open so legitimate
 * users are never locked out due to a slow backend.
 */
export function useProfileGuard(): { status: GuardStatus } {
  const router = useRouter()
  const { isReady, isLoggedIn, profile } = useLiffContext()
  // Start as 'ok' so the home page renders immediately.
  // The check runs in the background and only triggers a redirect on 404.
  const [status, setStatus] = useState<GuardStatus>('ok')
  // Prevent double-firing if the effect runs more than once with the same userId
  const checkedRef = useRef<string | null>(null)

  useEffect(() => {
    // Wait until LIFF SDK has finished initialising
    if (!isReady) return

    // Demo mode — no LIFF_ID configured, skip guard entirely
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId) {
      setStatus('ok')
      return
    }

    // LIFF is ready but user is not logged in yet — keep waiting.
    // (The LIFF SDK will redirect to LINE login automatically.)
    if (!isLoggedIn) return

    // Profile object may arrive slightly after isLoggedIn flips — keep waiting.
    if (!profile?.userId) return

    const lineUserId = profile.userId

    // Already ran for this user — skip
    if (checkedRef.current === lineUserId) return
    checkedRef.current = lineUserId

    const checkProfile = async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

      try {
        const res = await fetch(`/api/profile/${encodeURIComponent(lineUserId)}`, {
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (res.status === 404) {
          // Definitive: user has never registered
          setStatus('redirecting')
          router.replace('/register')
          return
        }

        if (!res.ok) {
          // 5xx or unexpected status — fail open, do not redirect
          console.warn('[useProfileGuard] non-404 error from profile API:', res.status, '— failing open')
          setStatus('ok')
          return
        }

        const data = await res.json()

        // Only redirect if all required fields are truly empty/missing
        const requiredFields = ['fullName', 'phoneNumber', 'gender', 'ageRange'] as const
        const isComplete = requiredFields.every(
          (f) => typeof data[f] === 'string' && data[f].trim() !== ''
        )

        if (!isComplete) {
          setStatus('redirecting')
          router.replace('/register')
          return
        }

        setStatus('ok')
      } catch (err: unknown) {
        clearTimeout(timeoutId)
        const isAbort =
          err instanceof DOMException && err.name === 'AbortError'
        if (isAbort) {
          // Timed out — backend is slow, fail open
          console.warn('[useProfileGuard] profile fetch timed out — failing open')
        } else {
          console.warn('[useProfileGuard] profile fetch failed — failing open:', err)
        }
        setStatus('ok')
      }
    }

    checkProfile()
  }, [isReady, isLoggedIn, profile, router])

  return { status }
}
