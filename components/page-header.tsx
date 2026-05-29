'use client'

import { Menu, Award } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Sidebar } from './sidebar'
import { useLiffContext } from '@/lib/liff-context'
import { useApp } from '@/lib/app-context'

interface PageHeaderProps {
  title?: string
  showBack?: boolean
  onBack?: () => void
}

export function PageHeader({ title, showBack = false, onBack }: PageHeaderProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { profile: liffProfile, isReady } = useLiffContext()
  const { userProfile } = useApp()

  // Use LINE profile if available, otherwise use demo data
  const displayName = liffProfile?.displayName || userProfile?.displayName || 'ผู้ใช้'
  const profilePicture = liffProfile?.pictureUrl || userProfile?.pictureUrl || '/placeholder-user.jpg'

  return (
    <>
      <header className="sticky top-0 bg-white border-b border-black/20 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between h-[50px] px-4">
          {/* Menu Button + LINE Username */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 rounded-full hover:bg-[#f5f5f5] transition-colors"
            >
              <Menu className="w-5 h-5 text-[#154212]" strokeWidth={2.5} />
            </button>
            
            {/* LINE Profile Picture + Username */}
            <Link href="/profile" className="flex items-center gap-1.5">
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
            </Link>
          </div>

          {/* User Badge on right */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#91c1e7] to-[#9fcba5] border border-[#154212]">
              <div className="relative w-5 h-5">
                <Award className="w-5 h-5 text-[#154212]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white shadow" />
                </div>
              </div>
              <span className="text-xs font-semibold text-[#154212]">นักอนุรักษ์มือใหม่</span>
            </div>
          </div>
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  )
}
