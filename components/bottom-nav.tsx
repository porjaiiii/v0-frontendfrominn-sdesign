'use client'

import { Trash2, Gift, BarChart3, BookOpen, Info } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', icon: Trash2, label: 'บันทึกขยะ' },
  { href: '/rewards', icon: Gift, label: 'แลกรางวัล' },
  { href: '/ranking', icon: BarChart3, label: 'อันดับ' },
  { href: '/how-to-use', icon: BookOpen, label: 'วิธีใช้งาน' },
  { href: '/contact', icon: Info, label: 'ติดต่อ' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#154212] z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-[75px] px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 w-[70px] h-[60px] rounded-lg transition-colors',
                isActive 
                  ? 'text-white' 
                  : 'text-white/50 hover:text-white/80'
              )}
            >
              <item.icon className="w-[18px] h-[18px]" strokeWidth={2} />
              <span className="text-[11px] font-semibold">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
