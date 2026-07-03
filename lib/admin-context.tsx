'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

// เปลี่ยนชื่อคีย์ให้สื่อถึง localStorage (หรือจะใช้ชื่อเดิมก็ได้ครับ)
const LOCAL_STORAGE_KEY = 'admin_session_persistent'

export type AdminLoginResult =
  | { success: true }
  | { success: false; reason: 'KEY_INVALID' | 'KEY_TAKEN' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR' }

interface AdminContextType {
  isAdmin: boolean
  isInitializing: boolean
  adminLogin: (key: string, userId: string) => Promise<AdminLoginResult>
  adminLogout: () => void
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  // Restore session from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 🔄 เปลี่ยนจาก sessionStorage เป็น localStorage
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (saved === 'true') {
        setIsAdmin(true)
      }
    }
    setIsInitializing(false)
  }, [])

  const adminLogin = useCallback(async (key: string, userId: string): Promise<AdminLoginResult> => {
    try {
      const res = await fetch('/api/admin/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: key, userId }),
      })

      if (res.ok) {
        setIsAdmin(true)
        // 🔄 เปลี่ยนมาบันทึกลง localStorage เพื่อให้คงอยู่ยาวนานขึ้น
        localStorage.setItem(LOCAL_STORAGE_KEY, 'true')
        return { success: true }
      }

      const body = await res.json().catch(() => ({}))
      const errorCode = body?.error ?? 'UNKNOWN_ERROR'

      if (errorCode === 'KEY_TAKEN') return { success: false, reason: 'KEY_TAKEN' }
      if (errorCode === 'KEY_INVALID') return { success: false, reason: 'KEY_INVALID' }
      return { success: false, reason: 'UNKNOWN_ERROR' }
    } catch {
      return { success: false, reason: 'NETWORK_ERROR' }
    }
  }, [])

  const adminLogout = useCallback(() => {
    setIsAdmin(false)
    // 🔄 ลบข้อมูลออกจาก localStorage เมื่อทำการ Logout
    localStorage.removeItem(LOCAL_STORAGE_KEY)
  }, [])

  return (
    <AdminContext.Provider value={{ isAdmin, isInitializing, adminLogin, adminLogout }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider')
  }
  return context
}