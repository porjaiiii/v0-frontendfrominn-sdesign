'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLiff } from '@/hooks/use-liff'

export default function RootPage() {
  const router = useRouter()
  const { isReady, isLoggedIn } = useLiff()

  useEffect(() => {
    if (!isReady) return

    // ถ้า LINE เปิด LIFF deep-link มา จะมี liff.state ที่เก็บ path ปลายทางไว้
    // ปล่อยให้ LIFF พาไปหน้านั้นเอง แทนที่จะดึงกลับมา /home หรือ /register
    // (แก้ปัญหาผู้ใช้ iPhone กดลิงก์ ranking/rewards แล้วเด้งกลับ home)
    const params = new URLSearchParams(window.location.search)
    if (params.has('liff.state')) return

    // ตรวจสอบจาก localStorage ว่าเคยลงทะเบียนหรือยัง
    const isRegistered = localStorage.getItem('is_registered') === 'true'

    if (isRegistered) {
      // ถ้าลงทะเบียนแล้ว ไป home
      router.replace('/home')
    } else {
      // ถ้ายังไม่ลงทะเบียน (หรือยังไม่มี flag) ไป register
      router.replace('/register')
    }
  }, [isReady, router])

  return null
}