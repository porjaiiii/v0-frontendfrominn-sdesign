'use client'

/**
 * Root route "/" — this is the registered LIFF endpoint.
 *
 * LINE always redirects back here after the permission screen, passing
 * ?liff.state= tokens in the URL. We MUST let liff.init() run and consume
 * those tokens BEFORE doing any navigation, otherwise the SDK never receives
 * the auth code and the session stays empty on mobile.
 *
 * Flow:
 *  1. Page mounts → LiffProvider (in layout) starts liff.init()
 *  2. LiffLoadingOverlay covers the screen while init runs
 *  3. Once isReady=true, useProfileGuard checks if the user has a profile:
 *     - No profile → redirect to /register
 *     - Has profile → redirect to /home
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLiffContext } from '@/lib/liff-context'
import { useProfileGuard } from '@/hooks/use-profile-guard'

export default function RootPage() {
  const router = useRouter()
  const { isReady, isLoggedIn } = useLiffContext()
  const { status: guardStatus } = useProfileGuard()

  useEffect(() => {
    // Only navigate after LIFF has fully initialised and the user is logged in.
    // guardStatus 'ok' means profile exists → go to home.
    // guardStatus 'redirecting' means useProfileGuard already pushed /register.
    if (!isReady || !isLoggedIn) return
    if (guardStatus === 'ok') {
      router.replace('/home')
    }
    // 'redirecting' is handled by useProfileGuard itself
  }, [isReady, isLoggedIn, guardStatus, router])

  // LiffLoadingOverlay from LiffProvider covers the screen — no blank flash.
  return null
}
