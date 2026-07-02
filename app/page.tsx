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
import { useLiff } from '@/hooks/use-liff'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()
  const { isLoggedIn, profile, loadingStep, isReady } = useLiff()

  useEffect(() => {
    // รอจนกว่า liff จะโหลดเสร็จและพร้อมใช้งาน
    if (!isReady) return

    // หาก LIFF พร้อมแล้ว ให้เช็คสถานะการเข้าสู่ระบบและข้อมูลโปรไฟล์
    // เงื่อนไข: ถ้าเข้าสู่ระบบแล้ว และมีข้อมูล profile (ซึ่งหมายถึงอนุญาตสิทธิ์แล้ว) 
    // ให้ไปหน้า /home
    if (isLoggedIn && profile) {
      router.replace('/home')
    }
    // หากยังไม่ได้เข้าสู่ระบบ หรือยังไม่มีข้อมูล profile 
    // ให้ไปหน้า /register เพื่อให้เริ่มขั้นตอนการให้สิทธิ์
    else if (loadingStep === 'ready') {
      router.replace('/register')
    }
  }, [isLoggedIn, profile, isReady, loadingStep, router])



  // ในระหว่างที่ loadingStep ไม่ใช่ 'ready' หรือยังไม่พร้อม 
  // ให้คืนค่า null เพื่อให้ LiffProvider หรือ Loading Overlay ทำงานแทน
  return null
}
