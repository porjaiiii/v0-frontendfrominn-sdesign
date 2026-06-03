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
    avatar: '/placeholder-user.jpg',
    location: ''
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

  const obfuscateName = (name: string, isCurrentUser = false) => {
    if (isCurrentUser) return name
    const parts = name.trim().split(/\s+/)
    const showLastN = (s: string, n = 2) => {
      if (s.length <= n + 1) return s
      return '...' + s.slice(-n)
    }
    const showFirstN = (s: string, n = 2) => {
      if (s.length <= n + 1) return s
      return s.slice(0, n) + '...'
    }

    if (parts.length === 1) {
      const p = parts[0]
      const first = showFirstN(p, 2)
      const last = showLastN(p, 2)
      // If name is very short, just return a shortened version
      if (p.length <= 4) return p
      return `${first} ${last}`
    }

    // For multiple parts (e.g., first + last), show start of first and end of last
    const firstPart = parts[0]
    const lastPart = parts[parts.length - 1]
    return `${showFirstN(firstPart, 2)} ${showLastN(lastPart, 2)}`
  }

  const getStarFilter = (rank: number) => {
    if (rank === 1) return 'sepia(1) saturate(6) hue-rotate(20deg) brightness(1)'
    if (rank === 2) return 'grayscale(1) brightness(0.9) contrast(1.2)'
    if (rank === 3) return 'sepia(1) saturate(5) hue-rotate(-10deg) brightness(0.95)'
    return 'none'
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
              <p className="text-sm text-white/90 mb-1">{currentUser.name}</p>
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

          {/* Podium for Top 3 */}
          <div className="flex items-end justify-center gap-4 mb-2">
            {[LEADERBOARD[1], LEADERBOARD[0], LEADERBOARD[2]].map((u) => {
              if (!u) return null
              const podiumHeight = u.rank === 1 ? 150 : 110
              const gradient = u.rank === 1
                ? 'linear-gradient(180deg,#fff7c9,#ffd24d)'
                : u.rank === 2
                ? 'linear-gradient(180deg,#eef6ff,#bcd7ff)'
                : 'linear-gradient(180deg,#ffe9e9,#ff9a9a)'
              const starFilter = getStarFilter(u.rank)
              return (
                <div key={u.rank} className="flex flex-col items-center relative">
                  {/* profile (avatar) above podium */}
                  <div className="w-16 h-16 rounded-full bg-[#0f3b14] overflow-hidden relative mb-2 shadow-md">
                    <Image src={u.avatar} alt={u.name} fill className="object-cover" />
                  </div>
                  {/* user name */}
                  <div className="text-sm font-medium text-[#154212] mb-2 text-center">
                    {obfuscateName(u.name, u.rank === currentUser.rank || u.name === currentUser.name)}
                  </div>

                  {/* podium block (top, star, carbon) */}
                  <div
                    className="w-24 rounded-t-lg flex flex-col items-center justify-start gap-1 shadow-inner"
                    style={{ height: podiumHeight, background: gradient, paddingTop: '10%' }}
                  >
                    <div className="w-8 h-8 flex items-center justify-center">
                      <Image
                        src="/images/icon/Michelin-Star--Streamline-Tabler.svg"
                        alt={`star-${u.rank}`}
                        width={20}
                        height={20}
                        className="object-contain"
                        style={{ filter: starFilter }}
                      />
                    </div>

                    <div className="flex flex-col items-center justify-center">
                      <div className="text-lg font-semibold text-[#154212]">{u.carbon}</div>
                      <div className="text-xs text-[#154212]">kgCO2</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tabs */}
          <div className="w-full max-w-sm mx-auto mb-2">
            <div className="bg-[#e7f6ea] p-1 rounded-2xl shadow-sm">
              <div className="flex">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex-1 text-center py-2 px-3 rounded-xl text-sm font-medium transition-all',
                      activeTab === tab.id
                        ? 'bg-[#154212] text-white shadow-md'
                        : 'text-[#154212]/90 bg-transparent hover:bg-white/60'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Leaderboard List */}
          <div className="rounded-3xl overflow-hidden">
            <div className="bg-gradient-to-b from-[#2a6e25] via-[#f7fbf7] to-white p-2">
              <div className="space-y-2">
                {LEADERBOARD.map((user) => {
                  if (user.rank < 4) return null;
                  const displayUser = user.rank === currentUser.rank ? currentUser : user
                  const cardBg = getRankCardBg(displayUser.rank)
                  return (
                    <div
                      key={displayUser.rank}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl',
                        cardBg
                      )}
                    >
                      {/* Rank Number */}
                      <div className="w-8 h-8 rounded-full bg-[#f5f5f5] flex items-center justify-center text-sm font-semibold text-[#154212]">
                        {displayUser.rank}
                      </div>
                      
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-[#d9d9d9] overflow-hidden relative flex-shrink-0">
                        <Image
                          src={displayUser.avatar}
                          alt={displayUser.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      
                      {/* Name & Location */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#444444] truncate">
                          {obfuscateName(displayUser.name, displayUser.rank === currentUser.rank || displayUser.name === currentUser.name)}
                        </p>
                        {displayUser.location && (
                          <p className="text-xs text-[#666666] flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {displayUser.location}
                          </p>
                        )}
                      </div>
                      
                      {/* Carbon Score */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-[#154212]">
                          {displayUser.carbon} <span className="text-xs text-[#666666]">kgCO2</span>
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
