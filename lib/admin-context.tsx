'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

const SESSION_KEY = 'admin_session'

export type AdminLoginResult =
  | { success: true }
  | { success: false; reason: 'KEY_INVALID' | 'KEY_TAKEN' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR' }

interface AdminContextType {
  isAdmin: boolean
  adminLogin: (key: string, userId: string) => Promise<AdminLoginResult>
  adminLogout: () => void
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)

  // Restore session on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (saved === 'true') setIsAdmin(true)
    }
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
        sessionStorage.setItem(SESSION_KEY, 'true')
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
    sessionStorage.removeItem(SESSION_KEY)
  }, [])

  return (
    <AdminContext.Provider value={{ isAdmin, adminLogin, adminLogout }}>
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
