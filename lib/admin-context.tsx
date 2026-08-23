'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

import { apiFetch } from './api-client'

// The admin session lives in an httpOnly cookie the server signs
// (lib/auth/admin-session.ts). It used to be
// `localStorage.admin_session_persistent = 'true'` — readable and writable by
// any script on the page, which meant one devtools line made you an admin, and
// no route ever checked. `isAdmin` below is now only a MIRROR of what the
// server already decided; it unlocks UI, it does not grant access.

export type AdminLoginResult =
  | { success: true }
  | { success: false; reason: 'KEY_INVALID' | 'KEY_TAKEN' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR' }

interface AdminContextType {
  isAdmin: boolean
  isInitializing: boolean
  adminLogin: (key: string, userId: string) => Promise<AdminLoginResult>
  adminLogout: () => Promise<void>
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  // Ask the server, because the cookie is httpOnly and cannot be read here.
  useEffect(() => {
    let cancelled = false

    fetch('/api/admin/session', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { isAdmin: false }))
      .then((data) => {
        if (!cancelled) setIsAdmin(Boolean(data?.isAdmin))
      })
      .catch(() => {
        // Offline or a failed request means "not an admin" — fail closed.
        if (!cancelled) setIsAdmin(false)
      })
      .finally(() => {
        if (!cancelled) setIsInitializing(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const adminLogin = useCallback(async (key: string, userId: string): Promise<AdminLoginResult> => {
    try {
      const res = await apiFetch('/api/admin/verify-key', {
        method: 'POST',
        body: JSON.stringify({ adminKey: key, userId }),
      })

      if (res.ok) {
        // The session cookie was set by the response itself; nothing to store.
        setIsAdmin(true)
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

  const adminLogout = useCallback(async () => {
    setIsAdmin(false)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } catch {
      // The UI is already locked; the cookie expires on its own after 30 days.
    }
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