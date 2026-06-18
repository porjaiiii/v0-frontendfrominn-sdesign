'use client'

import { X, Award, Trash2, BarChart3, Gift, BookOpen, Info, QrCode } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useLiffContext } from '@/lib/liff-context'
import { useApp } from '@/lib/app-context'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const menuItems = [
  { href: '/', icon: Trash2, label: 'บันทึกขยะ' },
  { href: '/ranking', icon: BarChart3, label: 'ยอดสะสมและอันดับ' },
  { href: '/rewards', icon: Gift, label: 'แลกรางวัล' },
  { href: '/how-to-use', icon: BookOpen, label: 'วิธีใช้งาน' },
  { href: '/contact', icon: Info, label: 'ติดต่อเจ้าหน้าที่' },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { profile: liffProfile } = useLiffContext()
  const { userProfile } = useApp()

  // Use LINE profile if available, otherwise use demo data
  const displayName = liffProfile?.displayName || userProfile?.displayName || 'ผู้ใช้'
  const profilePicture = liffProfile?.pictureUrl || userProfile?.pictureUrl || '/placeholder-user.jpg'

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/40 z-[60]"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-[258px] bg-white z-[60] animate-in slide-in-from-left">
        <div className="p-4">
          {/* Profile Section */}
          <div className="flex items-center gap-3.5 mb-3">
            <div className="relative w-[70px] h-[70px] rounded-full overflow-hidden border border-[#154212]">
              <Image
                src={profilePicture}
                alt="Profile"
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-[#154212] text-center">{displayName}</p>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#91c1e7] to-[#9fcba5] border border-[#154212] mt-1">
                <Award className="w-5 h-5 text-[#154212]" />
                <span className="text-xs font-semibold text-[#154212]">นักอนุรักษ์มือใหม่</span>
              </div>
              <Link href="/profile" className="block text-xs font-semibold text-[#154212] text-center mt-1 hover:underline" onClick={onClose}>
                ดูโปรไฟล์
              </Link>
              <Link href="/profile-scanner" className="block text-xs font-semibold text-[#154212] text-center mt-1 hover:underline" onClick={onClose}>
                สแกน QR Code
              </Link>
              <Link href="/coupon-scanner" className="flex items-center justify-center gap-1 text-xs font-semibold text-[#154212] text-center mt-1 hover:underline" onClick={onClose}>
                <QrCode className="w-3 h-3" />
                สแกนคูปอง
              </Link>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-[#154212] mb-3" />

          {/* Menu Items */}
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-2.5 py-1 text-sm font-semibold transition-colors',
                    isActive ? 'text-[#154212]' : 'text-[#154212]/80 hover:text-[#154212]'
                  )}
                >
                  <item.icon className="w-4 h-4" strokeWidth={1.8} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 left-0 right-0 px-4">
          <p className="text-xs font-semibold text-[#154212] text-center">
            &copy; Digital Wasted Account
          </p>
        </div>
      </div>
    </>
  )
}
