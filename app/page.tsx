'use client'

/**
 * Root route "/" — this is the registered LIFF endpoint.
 *
 * liff.login() always returns the user here after LINE grants permission.
 * We MUST let LiffProvider / useLiff finish initialising before we redirect,
 * otherwise the token LINE just issued never gets consumed and the user
 * loops back to the login screen on every visit from a non-LIFF URL.
 *
 * Flow:
 *   1. LIFF SDK inits, picks up the token from the URL hash/query
 *   2. isReady becomes true, profile is populated
 *   3. useProfileGuard checks whether the user has a saved profile
 *      → registered user  : redirect to /home
 *      → unregistered user: redirect to /register
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLiffContext } from '@/lib/liff-context'
import { useProfileGuard } from '@/hooks/use-profile-guard'

export default function RootPage() {
  const router = useRouter()
  const { isReady, profile } = useLiffContext()
  const { status: guardStatus } = useProfileGuard()

  useEffect(() => {
    if (!isReady) return

    // useProfileGuard handles the redirect to /register when no profile exists.
    // Once the profile is confirmed we send the user to /home.
    if (guardStatus === 'allowed' && profile?.userId) {
      router.replace('/home')
    }
  }, [isReady, guardStatus, profile, router])

  // LiffLoadingOverlay covers the screen while LIFF initialises.
  return null
}
