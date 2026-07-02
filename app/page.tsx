'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLiff } from '@/hooks/use-liff'

export default function RootPage() {
  const router = useRouter()
  const { isReady, isLoggedIn } = useLiff()

  useEffect(() => {
    if (!isReady) return

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