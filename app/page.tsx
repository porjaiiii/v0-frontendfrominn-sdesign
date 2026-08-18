'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useLiffContext } from '@/lib/liff-context'
import { getRegisteredCache, setRegisteredCache, clearRegisteredCache } from '@/lib/registration-cache'

// How long (ms) to wait for the profile API before giving up and failing
// open to /register. Matches the API route's own ~50s worst-case retry
// budget (fetchWithRetry: 2 attempts x 25s).
const FETCH_TIMEOUT_MS = 60_000

function CheckingOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-lg overflow-hidden">
          <Image
            src="/logo-qr-center.png"
            alt="mascot"
            width={80}
            height={80}
            className="object-contain w-full h-full"
            priority
            unoptimized
          />
        </div>
        <span className="text-[#154212] font-bold text-lg tracking-wide">
          Digital Wasted Account
        </span>
      </div>
      <svg
        className="animate-spin w-12 h-12 text-[#154212]"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p className="text-[#154212] font-semibold text-base mt-6 text-center px-6">
        กำลังตรวจสอบข้อมูลการลงทะเบียน
      </p>
    </div>
  )
}

export default function RootPage() {
  const router = useRouter()
  const { isReady, isLoggedIn, profile } = useLiffContext()
  const [checking, setChecking] = useState(false)
  // Prevent double-firing the DB fallback check for the same user
  const checkedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isReady) return

    // ถ้า LINE เปิด LIFF deep-link มา จะมี liff.state ที่เก็บ path ปลายทางไว้
    // ปล่อยให้ LIFF พาไปหน้านั้นเอง แทนที่จะดึงกลับมา /home หรือ /register
    // (แก้ปัญหาผู้ใช้ iPhone กดลิงก์ ranking/rewards แล้วเด้งกลับ home)
    const params = new URLSearchParams(window.location.search)
    if (params.has('liff.state')) return

    // Dev/QA escape hatch: open the LIFF URL with ?resetCache=1 to force a
    // fresh DB check instead of trusting whatever is cached on the device.
    // Useful for testing without uninstalling the LINE app.
    if (params.get('resetCache') === '1') {
      clearRegisteredCache()
    }

    // ตรวจสอบจาก localStorage ว่าเคยลงทะเบียนหรือยัง — fast path, no API call,
    // but only while the cache is still fresh (see lib/registration-cache.ts
    // for why this now expires instead of lasting forever).
    const cache = getRegisteredCache()
    if (cache.status === 'fresh') {
      router.replace('/home')
      return
    }

    // Demo mode — no LIFF_ID configured, so there's no LINE user to check
    // against the database. Fall back to cache-only behavior.
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId) {
      router.replace('/register')
      return
    }

    // Cache says "not registered" (or is simply empty, e.g. a new device).
    // That's not definitive — verify against the database before deciding.
    if (!isLoggedIn) return
    if (!profile?.userId) return

    const lineUserId = profile.userId
    if (checkedRef.current === lineUserId) return
    checkedRef.current = lineUserId

    const checkProfile = async () => {
      setChecking(true)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

      try {
        const res = await fetch(`/api/profile/${encodeURIComponent(lineUserId)}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        clearTimeout(timeoutId)

        if (res.status === 404) {
          // Definitive: user is not registered in the DB right now. Clear any
          // stale cached flag (e.g. left over from before a reset/delete) so
          // we don't keep trusting it once the TTL check above lets a stale
          // cache through.
          clearRegisteredCache()
          router.replace('/register')
          return
        }

        if (!res.ok) {
          // 5xx / ambiguous error — can't confirm either way. Fail open:
          // if we still have a (stale but not-yet-disproven) cached "registered"
          // flag, trust it rather than bouncing a real user to /register just
          // because the DB was briefly unreachable.
          console.warn('[RootPage] non-404 error from profile API:', res.status, '— falling back')
          if (cache.status === 'stale') {
            router.replace('/home')
          } else {
            router.replace('/register')
          }
          return
        }

        const data = await res.json()
        const hasProfile =
          typeof data?.fullName === 'string' && data.fullName.trim() !== ''

        if (hasProfile) {
          // Registered in the database — (re)write the cache with a fresh
          // timestamp so the next TTL_MS window skips the API call again.
          setRegisteredCache()
          router.replace('/home')
        } else {
          clearRegisteredCache()
          router.replace('/register')
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId)
        const isAbort = err instanceof DOMException && err.name === 'AbortError'
        console.warn(
          isAbort
            ? '[RootPage] profile fetch timed out — falling back'
            : '[RootPage] profile fetch failed — falling back',
          err
        )
        // Same fail-open reasoning as the 5xx branch above: don't punish a
        // real registered user with a redirect just because the network
        // request itself failed or timed out.
        router.replace(cache.status === 'stale' ? '/home' : '/register')
      }
    }

    checkProfile()
  }, [isReady, isLoggedIn, profile, router])

  return checking ? <CheckingOverlay /> : null
}