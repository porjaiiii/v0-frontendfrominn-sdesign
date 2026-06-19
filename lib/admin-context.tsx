'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

const ADMIN_KEY = 'admin1234'
const SESSION_KEY = 'admin_session'

interface AdminContextType {
  isAdmin: boolean
  adminLogin: (key: string) => boolean
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

  const adminLogin = useCallback((key: string): boolean => {
    if (key === ADMIN_KEY) {
      setIsAdmin(true)
      sessionStorage.setItem(SESSION_KEY, 'true')
      return true
    }
    return false
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
