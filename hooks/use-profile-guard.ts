'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiffContext } from '@/lib/liff-context'

type GuardStatus = 'loading' | 'ok' | 'redirecting'

/**
 * Checks whether the current LINE user has a completed registration profile.
 * If required fields (fullName, phoneNumber, gender, ageRange) are missing,
 * the user is redirected to /register.
 *
 * Returns `status`:
 *  - 'loading'     — still waiting for LIFF init or API response
 *  - 'ok'          — profile exists and is complete; render the page
 *  - 'redirecting' — profile missing; redirect in progress
 */
export function useProfileGuard(): { status: GuardStatus } {
  const router = useRouter()
  const { isReady, profile } = useLiffContext()
  const [status, setStatus] = useState<GuardStatus>('loading')

  useEffect(() => {
    // Wait until LIFF has finished initialising
    if (!isReady) return

    // If LIFF has no LIFF_ID configured (demo mode) skip the guard
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId) {
      setStatus('ok')
      return
    }

    // If profile hasn't loaded yet, keep waiting
    if (!profile?.userId) return

    const lineUserId = profile.userId

    const checkProfile = async () => {
      try {
        const res = await fetch(`/api/profile/${encodeURIComponent(lineUserId)}`)

        if (res.status === 404) {
          // User not registered yet
          setStatus('redirecting')
          router.replace('/register')
          return
        }

        if (!res.ok) {
          // Network/server error — fail open so users aren't locked out
          console.error('[useProfileGuard] profile fetch error:', res.status)
          setStatus('ok')
          return
        }

        const data = await res.json()

        // Validate that the required fields are actually populated
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
      } catch (err) {
        // Fail open on unexpected errors
        console.error('[useProfileGuard] unexpected error:', err)
        setStatus('ok')
      }
    }

    checkProfile()
  }, [isReady, profile, router])

  return { status }
}
