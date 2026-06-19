'use client'

import { Menu } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Sidebar } from './sidebar'
import { AdminLoginModal } from './admin-login-modal'
import { useLiffContext } from '@/lib/liff-context'
import { useApp } from '@/lib/app-context'
import { useAdmin } from '@/lib/admin-context'

interface PageHeaderProps {
  title?: string
  showBack?: boolean
  onBack?: () => void
}

export function PageHeader({ title, showBack = false, onBack }: PageHeaderProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const { profile: liffProfile, isReady } = useLiffContext()
  const { userProfile } = useApp()
  const { isAdmin } = useAdmin()

  const handleMenuClick = () => {
    if (isAdmin) {
      setSidebarOpen(true)
    } else {
      setLoginModalOpen(true)
    }
  }

  // While LIFF is still initializing we don't yet know who the user is —
  // show a shimmer instead of a scary "loading" name.
  const isProfileLoading = !isReady

  // Use LINE profile if available, otherwise fall back to a friendly guest name
  const displayName = liffProfile?.displayName || userProfile?.displayName || 'ผู้เยี่ยมชม'
  const profilePicture = liffProfile?.pictureUrl || userProfile?.pictureUrl || '/placeholder-user.jpg'

  return (
    <>
      <header className="sticky top-0 bg-white border-b border-black/20 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between h-[50px] px-4">
          {/* LINE Profile Picture + Username */}
          <Link href="/profile" className="flex items-center gap-1.5">
            {isProfileLoading ? (
              <>
                <div className="w-[28px] h-[28px] rounded-full shimmer flex-shrink-0" />
                <div className="h-4 w-20 rounded shimmer" />
              </>
            ) : (
              <>
                <div className="relative w-[28px] h-[28px] rounded-full overflow-hidden border border-[#154212] flex-shrink-0">
                  <Image
                    src={profilePicture}
                    alt="Profile"
                    fill
                    className="object-cover"
                  />
                </div>
                <span className="text-sm font-medium text-[#154212] max-w-[100px] truncate">
                  {displayName}
                </span>
              </>
            )}
          </Link>

          {/* Menu Button — invisible but still clickable */}
          <button
            onClick={handleMenuClick}
            aria-label="เปิดเมนู"
            className="p-1 rounded-full opacity-0"
          >
            <Menu className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <AdminLoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={() => {
          setLoginModalOpen(false)
          setSidebarOpen(true)
        }}
      />
    </>
  )
}
