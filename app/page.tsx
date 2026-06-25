'use client'

/**
 * Root route "/" — this is the LIFF entry point.
 *
 * The LIFF app always opens at "/" first. We immediately redirect to
 * "/register" which is the correct first-time landing page.
 * use-liff.ts handles saving the intended path before LINE's permission
 * screen and restoring it afterwards, so deep-links (e.g. "/home") still
 * work correctly.
 *
 * Registered users who land here via useProfileGuard will be redirected
 * to "/home" automatically by that hook after their profile is confirmed.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/register')
  }, [router])

  // Return null — LiffLoadingOverlay from LiffProvider covers the screen
  // while LIFF initialises, so the user never sees a blank flash.
  return null
}
