'use client'

import { useState } from 'react'
import Image from 'next/image'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { cn } from '@/lib/utils'
import { Leaf, MapPin } from 'lucide-react'
import Link from 'next/link'

// Mock data based on Figma
const LEADERBOARD = [
  { rank: 1, name: 'สมชาย ใจดี', carbon: 256.5, location: 'ต.บางกะเจ้า', avatar: '/placeholder.svg?height=40&width=40&query=thai man avatar' },
  { rank: 2, name: 'สมหญิง รักษ์โลก', carbon: 234.3, location: '', avatar: '/placeholder.svg?height=40&width=40&query=thai woman avatar' },
  { rank: 3, name: 'มนัส เกื้อกูล', carbon: 112.4, location: '', avatar: '/placeholder.svg?height=40&width=40&query=thai person avatar' },
  { rank: 4, name: 'กมลา ตาวุดีมี', carbon: 89, location: '', avatar: '/placeholder.svg?height=40&width=40&query=thai woman avatar 2' },
  { rank: 5, name: 'สมหญิง รักษ์โลก', carbon: 78, location: '', avatar: '/placeholder.svg?height=40&width=40&query=thai woman avatar 3' },
  { rank: 6, name: 'สมหญิง รักษ์โลก', carbon: 76, location: '', avatar: '/placeholder.svg?height=40&width=40&query=thai woman avatar 4' },
  { rank: 7, name: 'สมหญิง รักษ์โลก', carbon: 74, location: '', avatar: '/placeholder.svg?height=40&width=40&query=thai man avatar 2' },
]

const tabs = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'district', label: 'ตำบล' },
]

export default function RankingPage() {
  const [activeTab, setActiveTab] = useState('all')
  
  const currentUser = {
    rank: 5,
    name: 'สมชาย มั่นคงผล',
    carbon: 100,
    avatar: '/placeholder-user.jpg'
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { bg: 'bg-[#ffc818]', icon: 'text-[#ffc818]' }
    if (rank === 2) return { bg: 'bg-[#c1c1c1]', icon: 'text-[#c1c1c1]' }
    if (rank === 3) return { bg: 'bg-[#c06161]', icon: 'text-[#c06161]' }
    return { bg: 'bg-[#e5e5e5]', icon: 'text-[#999999]' }
  }

  const getRankCardBg = (rank: number) => {
    if (rank === 1) return 'bg-[#f9e7b0] border-l-4 border-l-[#ffc818]'
    if (rank === 2) return 'bg-[#e5e5e5] border-l-4 border-l-[#c1c1c1]'
    if (rank === 3) return 'bg-[#f5c4c4] border-l-4 border-l-[#c06161]'
    return 'bg-white border border-[#e5e5e5]'
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Page Title */}
        <h1 className="text-lg font-semibold text-[#154212] flex items-center gap-2 mb-4">
          <span className="text-[#666666]">{'<'}</span> ยอดสะสมและอันดับ
        </h1>

        {/* Current User Stats Card */}
        <div className="bg-[#154212] rounded-2xl p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-white">
              <Image
                src={currentUser.avatar}
                alt={currentUser.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white/80 mb-1">ยอดสะสมของคุณ</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">{currentUser.carbon}</span>
                <span className="text-sm text-white/80">kgCO2</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/80">อันดับ</p>
              <p className="text-2xl font-bold text-white">#{currentUser.rank}</p>
            </div>
          </div>
          {/* History Button inside card */}
          <Link 
            href="/history"
            className="inline-block mt-3 px-4 py-1.5 bg-white rounded-lg text-sm font-medium text-[#154212] hover:bg-[#f5f5f5] transition-colors"
          >
            ประวัติการสะสม
          </Link>
        </div>

        {/* Leaderboard Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#154212] flex items-center gap-2">
              <Leaf className="w-5 h-5 text-[#157b03]" />
              อันดับผู้รักษ์โลก : ต้นแมงลางตลิ่ง
            </h2>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-[#e5e5e5] pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-1 text-sm font-medium rounded-full transition-colors',
                  activeTab === tab.id
                    ? 'bg-[#154212] text-white'
                    : 'text-[#666666] hover:bg-[#f5f5f5]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Leaderboard List */}
          <div className="space-y-2">
            {LEADERBOARD.map((user) => {
              const rankBadge = getRankBadge(user.rank)
              const cardBg = getRankCardBg(user.rank)
              return (
                <div
                  key={user.rank}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl',
                    cardBg
                  )}
                >
                  {/* Rank Star Icon */}
                  <div className={cn('text-xl', rankBadge.icon)}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                  
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#d9d9d9] overflow-hidden relative flex-shrink-0">
                    <Image
                      src={user.avatar}
                      alt={user.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  
                  {/* Name & Location */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#444444] truncate">
                      {user.name}
                    </p>
                    {user.location && (
                      <p className="text-xs text-[#666666] flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {user.location}
                      </p>
                    )}
                  </div>
                  
                  {/* Carbon Score */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-[#154212]">
                      {user.carbon} <span className="text-xs text-[#666666]">kgCO2</span>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
    // test
  )
}
