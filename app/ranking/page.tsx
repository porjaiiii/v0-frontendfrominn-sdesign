'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { PageHeader } from '@/components/page-header'
import { cn } from '@/lib/utils'
import { Leaf, MapPin } from 'lucide-react'
import Link from 'next/link'
import type { RankingEntry } from '@/app/api/ranking/route'
import { useLiffContext } from '@/lib/liff-context'

type LeaderboardEntry = {
  rank: number
  lineUserId?: string
  name: string
  carbon: number
  location: string
  avatar: string
}

// Sub-districts of บางกะเจ้า (คลองสาน, พระประแดง)
const BANGKACHAO_SUBDISTRICTS = [
  'บางกะเจ้า',
  'บางน้ำผึ้ง',
  'บางกอบัว',
  'บางกระสอบ',
  'บางยอ',
  'ทรงคะนอง',
  'ทรงคนอง', // alternate spelling found in profile sheet data
]

function isBangkachaoSubdistrict(location: string): boolean {
  const normalized = location.replace(/^ตำบล|^ต\./, '').trim()
  return BANGKACHAO_SUBDISTRICTS.some(s => normalized === s || normalized.includes(s))
}

const tabs = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'district', label: 'ตำบล' },
]

export default function RankingPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [realLeaderboard, setRealLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSampleData, setIsSampleData] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isCurrentUserInView, setIsCurrentUserInView] = useState(false)
  const currentUserObserverRef = useRef<IntersectionObserver | null>(null)

  const currentUserRowRef = useCallback((el: HTMLDivElement | null) => {
    if (currentUserObserverRef.current) {
      currentUserObserverRef.current.disconnect()
      currentUserObserverRef.current = null
    }
    if (!el) { setIsCurrentUserInView(false); return }
    currentUserObserverRef.current = new IntersectionObserver(
      ([entry]) => setIsCurrentUserInView(entry.isIntersecting),
      { threshold: 0.5 }
    )
    currentUserObserverRef.current.observe(el)
  }, [])

  const { profile: liffProfile } = useLiffContext()

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setFetchError(null)
    const params = new URLSearchParams()
    if (liffProfile?.userId) params.set('userId', liffProfile.userId)
    if (liffProfile?.displayName) params.set('name', liffProfile.displayName)
    const url = `/api/points/ranking${params.toString() ? `?${params}` : ''}`
    fetch(url, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setFetchError(data.error)
          return
        }
        setRealLeaderboard(
          (data.ranking as RankingEntry[]).map(e => ({
            rank: e.rank,
            lineUserId: e.lineUserId,
            name: e.name,
            carbon: e.carbon,
            location: e.location,
            avatar: e.avatar,
          }))
        )
        setIsSampleData(data.isSample)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setFetchError('ไม่สามารถโหลดข้อมูลได้')
      })
      .finally(() => setIsLoading(false))
    return () => controller.abort()
  }, [liffProfile?.userId])

  const baseLeaderboard = realLeaderboard

  // Patch the logged-in user's name/avatar from LIFF (API falls back to ผู้ใช้ X when profile sheet lacks the entry)
  const leaderboard = liffProfile
    ? baseLeaderboard.map(e =>
        e.lineUserId === liffProfile.userId
          ? { ...e, name: liffProfile.displayName, avatar: liffProfile.pictureUrl ?? e.avatar }
          : e
      )
    : baseLeaderboard

  const currentUserEntry = liffProfile
    ? baseLeaderboard.find(u => u.lineUserId === liffProfile.userId)
    : undefined

  const currentUser = {
    rank: currentUserEntry?.rank ?? 0,
    name: liffProfile?.displayName ?? 'ผู้ใช้',
    carbon: currentUserEntry?.carbon ?? 0,
    avatar: liffProfile?.pictureUrl ?? '/placeholder-user.jpg',
    location: currentUserEntry?.location ?? '',
  }

  // For district tab, filter to entries from the 6 บางกะเจ้า sub-districts and re-rank from 1
  const displayLeaderboard = activeTab === 'district'
    ? leaderboard
        .filter(u => u.location && isBangkachaoSubdistrict(u.location))
        .map((u, i) => ({ ...u, rank: i + 1 }))
    : leaderboard

  // Rank shown in the sticky — uses district rank when in ตำบล tab, overall rank otherwise
  const currentUserDisplayEntry = displayLeaderboard.find(e =>
    liffProfile != null && e.lineUserId === liffProfile.userId
  )
  const stickyRank = currentUserDisplayEntry?.rank ?? currentUser.rank

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
      if (p.length <= 4) return p
      return `${showFirstN(p, 2)} ${showLastN(p, 2)}`
    }
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

  const top3 = [displayLeaderboard[1], displayLeaderboard[0], displayLeaderboard[2]]
  const listEntries = displayLeaderboard.filter(u => u.rank >= 4)

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
              <p className="text-2xl font-bold text-white">
                {currentUser.rank > 0 ? `#${currentUser.rank}` : '-'}
              </p>
            </div>
          </div>
          <Link
            href="/history"
            className="inline-block mt-3 px-4 py-1.5 bg-white rounded-lg text-sm font-medium text-[#154212] hover:bg-[#f5f5f5] transition-colors"
          >
            ประวัติการสะสม
          </Link>
        </div>

        {/* Leaderboard Section */}
        <div className="space-y-3">
          {/* Section heading */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#154212] flex items-center gap-2">
              <Leaf className="w-5 h-5 text-[#157b03]" />
              อันดับผู้รักษ์โลก : ต้นแมงลางตลิ่ง
            </h2>
          </div>

          {/* Sample data notice */}
          {isSampleData && !isLoading && (
            <div className="text-xs text-[#999] bg-[#fffbe6] border border-[#ffe58f] rounded-lg px-3 py-2">
              กำลังแสดงข้อมูลตัวอย่าง — ยังไม่มีข้อมูลในระบบคะแนน
            </div>
          )}

          {/* Fetch error notice */}
          {fetchError && !isLoading && (
            <div className="text-xs text-[#cc0000] bg-[#fff0f0] border border-[#ffb3b3] rounded-lg px-3 py-2">
              {fetchError}
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="space-y-2 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-[#f0f0f0] rounded-xl" />
              ))}
            </div>
          )}

          {!isLoading && (
            <>
              {/* Podium for Top 3 */}
              <div className="flex items-end justify-center gap-4 mb-2">
                {top3.map((u) => {
                  if (!u) return null
                  const podiumHeight = u.rank === 1 ? 150 : 110
                  const gradient = u.rank === 1
                    ? 'linear-gradient(180deg,#fff7c9,#ffd24d)'
                    : u.rank === 2
                    ? 'linear-gradient(180deg,#eef6ff,#bcd7ff)'
                    : 'linear-gradient(180deg,#ffe9e9,#ff9a9a)'
                  const starFilter = getStarFilter(u.rank)
                  const isPodiumCurrent = liffProfile != null && u.lineUserId === liffProfile.userId
                  return (
                    <div key={u.rank} ref={isPodiumCurrent ? currentUserRowRef : undefined} className="flex flex-col items-center relative">
                      <div className="w-16 h-16 rounded-full bg-[#0f3b14] overflow-hidden relative mb-2 shadow-md">
                        <Image src={u.avatar} alt={u.name} fill className="object-cover" />
                      </div>
                      <div className="text-sm font-medium text-[#154212] mb-2 text-center">
                        {obfuscateName(u.name, u.rank === currentUser.rank || u.name === currentUser.name || u.lineUserId === liffProfile?.userId)}
                      </div>
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


              {/* Leaderboard List */}
              <div className="rounded-3xl overflow-hidden">
                <div className="bg-gradient-to-b from-[#2a6e25] via-[#f7fbf7] to-white p-2">
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
                  {listEntries.length === 0 ? (
                    <p className="text-center text-sm text-[#999] py-4">ไม่มีข้อมูล</p>
                  ) : (
                    <div className="space-y-2">
                      {listEntries.map((user) => {
                        const isCurrent = liffProfile != null && user.lineUserId === liffProfile.userId
                        const displayUser = isCurrent
                          ? { ...user, name: currentUser.name, avatar: currentUser.avatar }
                          : user
                        const cardBg = getRankCardBg(displayUser.rank)
                        return (
                          <div
                            key={displayUser.rank}
                            ref={isCurrent ? currentUserRowRef : undefined}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-xl',
                              cardBg
                            )}
                          >
                            <div className="w-8 h-8 rounded-full bg-[#f5f5f5] flex items-center justify-center text-sm font-semibold text-[#154212]">
                              {displayUser.rank}
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#d9d9d9] overflow-hidden relative flex-shrink-0">
                              <Image
                                src={displayUser.avatar}
                                alt={displayUser.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#444444] truncate">
                                {obfuscateName(displayUser.name, isCurrent)}
                              </p>
                              {displayUser.location && (
                                <p className="text-xs text-[#666666] flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {displayUser.location}
                                </p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-[#154212]">
                                {displayUser.carbon} <span className="text-xs text-[#666666]">kgCO2</span>
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Sticky placement card — shown when current user is not visible in the leaderboard */}
      {!isLoading && stickyRank > 0 && !isCurrentUserInView && (
        <div className="fixed bottom-24 left-0 right-0 max-w-md mx-auto px-4 z-50">
          <div className="bg-[#d4edda] border border-[#a8d5b5] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
            <span className="text-sm font-bold text-[#154212] w-8 text-center">#{stickyRank}</span>
            <div className="w-10 h-10 rounded-full overflow-hidden relative flex-shrink-0">
              <Image src={currentUser.avatar} alt="คุณ" fill className="object-cover" />
            </div>
            <p className="text-sm font-semibold text-[#154212] flex-1">คุณ</p>
            <p className="text-sm font-semibold text-[#154212]">
              {currentUser.carbon} <span className="text-xs text-[#666666]">kgCO2</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
