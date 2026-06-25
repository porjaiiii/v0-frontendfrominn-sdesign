'use client'

import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { ChevronLeft, MoreVertical, Recycle, Gift, Coins } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useLiffContext } from '@/lib/liff-context'

// One color per type, shared by the filter chips and the timeline dots so they
// always match. recycle = blue, points = green, reward = yellow.
const TYPE_COLOR: Record<string, string> = {
  recycle: 'bg-[#89b9ea]',
  points: 'bg-[#b6ebad]',
  reward: 'bg-[#f9e7b0]',
}

// Filter tabs
const FILTERS = [
  { id: 'all', label: 'ทั้งหมด', icon: null },
  { id: 'recycle', label: 'รีไซเคิล', icon: Recycle, color: TYPE_COLOR.recycle },
  { id: 'reward', label: 'แลกรางวัล', icon: Gift, color: TYPE_COLOR.reward },
  { id: 'points', label: 'คะแนน', icon: Coins, color: TYPE_COLOR.points },
]

type HistoryItem = {
  id: string
  ts?: number         // epoch ms, for chronological sorting across sources
  date: string
  time: string
  type: string        // 'recycle' | 'points' | 'reward'
  title: string
  color: string
  hasDetail?: boolean
  // reward-specific (from spend_details)
  quantity?: number
  status?: string
  pointsSpent?: number
  category?: 'reward' | 'donate'
}

// A single transaction row from /api/points?action=get_transactions
type Transaction = {
  tx_id: string
  type: string
  points: number
  co2: number
  weight?: number
  timestamp: string
}

// A single spend line from /api/points?action=get_spend_details
type SpendDetailRow = {
  tx_id: string
  category: 'reward' | 'donate'
  item_name: string
  quantity: number
  points: number
  status: string
  timestamp: string
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

// Script timestamps look like "2026-06-11 13:03:14" (Bangkok). Parse safely.
function parseTs(ts: string): Date {
  return new Date(String(ts).replace(' ', 'T'))
}

function fmtDate(d: Date) {
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}
function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Earn transactions -> recycle / points entries. (Spends are handled by
// spend_details so we can show item names + status, so 'spend' is skipped here.)
function txToHistoryItem(tx: Transaction): HistoryItem | null {
  if (tx.type === 'spend') return null
  const d = parseTs(tx.timestamp)
  const base = { id: tx.tx_id, ts: d.getTime(), date: fmtDate(d), time: fmtTime(d) }
  // Round away floating-point artifacts from the sheet (weight × factor sums):
  // weight to 2 decimals, points to a whole number.
  const weight = Math.round((Number(tx.weight) || 0) * 100) / 100
  const points = Math.round(Number(tx.points) || 0)

  // earn with recycled weight -> recycle entry (has detail)
  if (weight > 0) {
    return { ...base, type: 'recycle', title: `เก็บของรีไซเคิล ${weight} KG`, color: TYPE_COLOR.recycle, hasDetail: true }
  }
  // earn without weight (e.g. bonus) -> points entry
  return { ...base, type: 'points', title: `คุณมีคะแนนสะสมเพิ่ม ${points} คะแนน`, color: TYPE_COLOR.points }
}

// Spend detail rows -> rich reward/donation entries.
function spendDetailToItem(d: SpendDetailRow): HistoryItem {
  const date = parseTs(d.timestamp)
  const isDonate = d.category === 'donate'
  const verb = isDonate ? 'บริจาคให้' : 'แลกของรางวัล'
  return {
    id: `${d.tx_id}-${d.item_name}`,
    ts: date.getTime(),
    date: fmtDate(date),
    time: fmtTime(date),
    type: 'reward',
    title: `${verb} ${d.item_name}`,
    color: TYPE_COLOR.reward,
    quantity: Number(d.quantity) || 1,
    // Donations complete instantly — they don't have a delivery status.
    status: isDonate ? 'บริจาคสำเร็จ' : (d.status || 'เตรียมจัดส่งในรอบถัดไป'),
    pointsSpent: Number(d.points) || 0,
    category: d.category,
  }
}

// Mock history data with time
const historyData: HistoryItem[] = [
  {
    id: '1',
    date: '27 พฤษภาคม 2569',
    time: '14:30',
    type: 'points',
    title: 'คุณมีคะแนนสะสมเพิ่ม 21 คะแนน',
    color: TYPE_COLOR.points,
  },
  {
    id: '2',
    date: '27 พฤษภาคม 2569',
    time: '12:15',
    type: 'recycle',
    title: 'เก็บของรีไซเคิล 7.95 KG',
    color: TYPE_COLOR.recycle,
    hasDetail: true,
  },
  {
    id: '3',
    date: '27 พฤษภาคม 2569',
    time: '10:00',
    type: 'reward',
    title: 'แลกรางวัลจากคะแนน 35 คะแนน',
    color: TYPE_COLOR.reward,
  },
  {
    id: '4',
    date: '27 พฤษภาคม 2569',
    time: '09:30',
    type: 'points',
    title: 'คุณมีคะแนนสะสมเพิ่ม 21 คะแนน',
    color: TYPE_COLOR.points,
  },
  {
    id: '5',
    date: '26 พฤษภาคม 2569',
    time: '16:45',
    type: 'recycle',
    title: 'เก็บของรีไซเคิล 7.95 KG',
    color: TYPE_COLOR.recycle,
    hasDetail: true,
  },
  {
    id: '6',
    date: '26 พฤษภาคม 2569',
    time: '11:20',
    type: 'points',
    title: 'คุณมีคะแนนสะสมเพิ่ม 21 คะแนน',
    color: TYPE_COLOR.points,
  },
  {
    id: '7',
    date: '25 พฤษภาคม 2569',
    time: '08:00',
    type: 'recycle',
    title: 'เก็บของรีไซเคิล 7.95 KG',
    color: TYPE_COLOR.recycle,
    hasDetail: true,
  },
]

// Group data by date
function groupByDate(data: HistoryItem[]) {
  const groups: { [key: string]: HistoryItem[] } = {}
  data.forEach(item => {
    if (!groups[item.date]) {
      groups[item.date] = []
    }
    groups[item.date].push(item)
  })
  return groups
}

// Format time to Thai style
function formatTime(time: string) {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  return `${hour}.${minutes} น.`
}

export default function HistoryPage() {
  const router = useRouter()
  const { profile: liffProfile } = useLiffContext()
  const [activeFilter, setActiveFilter] = useState('all')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[] | null>(null)
  const [spendDetails, setSpendDetails] = useState<SpendDetailRow[] | null>(null)

  // Pull this user's real transactions + spend details from the points sheet.
  useEffect(() => {
    const userId = liffProfile?.userId
    if (!userId) return
    const controller = new AbortController()
    const q = encodeURIComponent(userId)

    fetch(`/api/points?action=get_transactions&user_id=${q}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setTransactions(data?.success ? (data.transactions as Transaction[]) : []))
      .catch(err => { if (err.name !== 'AbortError') setTransactions([]) })

    fetch(`/api/points?action=get_spend_details&user_id=${q}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setSpendDetails(data?.success ? (data.details as SpendDetailRow[]) : []))
      .catch(err => { if (err.name !== 'AbortError') setSpendDetails([]) })

    return () => controller.abort()
  }, [liffProfile?.userId])

  // Earn -> recycle/points entries; spend_details -> rich reward entries.
  const earnItems = (transactions ?? [])
    .map(txToHistoryItem)
    .filter((i): i is HistoryItem => i !== null)
  const rewardItems = (spendDetails ?? []).map(spendDetailToItem)
  const realItems = [...earnItems, ...rewardItems].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))

  // Still waiting on the Google Sheet fetch for a logged-in user.
  const isLoading =
    !!liffProfile?.userId && (transactions === null || spendDetails === null)

  // Show only real data — no mock fallback.
  const sourceData = realItems

  const filteredData = activeFilter === 'all'
    ? sourceData
    : sourceData.filter(item => item.type === activeFilter)

  const groupedData = groupByDate(filteredData)

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Back Button and Title */}
        <div className="flex items-center gap-2 mb-4">
          <button 
            onClick={() => router.back()}
            className="p-1 rounded-full hover:bg-[#f5f5f5]"
          >
            <ChevronLeft className="w-6 h-6 text-[#666666]" />
          </button>
          <h1 className="text-lg font-semibold text-[#154212]">การใช้งานย้อนหลัง</h1>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                activeFilter === filter.id
                  ? 'bg-[#154212] text-white'
                  : 'bg-[#f5f5f5] text-[#666666] hover:bg-[#e5e5e5]'
              )}
            >
              {filter.icon && (
                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center', filter.color)}>
                  <filter.icon className="w-3 h-3 text-[#154212]" />
                </div>
              )}
              {filter.label}
            </button>
          ))}
        </div>

        {/* Loading skeleton — while fetching from Google Sheet */}
        {isLoading && (
          <div className="space-y-6">
            {[...Array(2)].map((_, g) => (
              <div key={g}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-[#e5e5e5]" />
                  <div className="h-4 w-28 bg-[#f0f0f0] rounded animate-pulse" />
                </div>
                <div className="ml-[3px] border-l-2 border-[#e5e5e5] pl-5 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#e5e5e5]">
                      <div className="w-10 h-10 rounded-full bg-[#f0f0f0] animate-pulse flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-16 bg-[#f0f0f0] rounded animate-pulse" />
                        <div className="h-4 w-2/3 bg-[#f0f0f0] rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state — no history to show */}
        {!isLoading && filteredData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f5] flex items-center justify-center mb-3">
              <Recycle className="w-7 h-7 text-[#b5b5b5]" />
            </div>
            <p className="text-sm text-[#999999]">ยังไม่มีประวัติการใช้งาน</p>
          </div>
        )}

        {/* History List Grouped by Date */}
        <div className="space-y-6">
          {Object.entries(groupedData).map(([date, items]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#154212]" />
                <h2 className="text-sm font-semibold text-[#154212]">{date}</h2>
              </div>

              {/* Timeline Items */}
              <div className="ml-[3px] border-l-2 border-[#e5e5e5] pl-5 space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="relative"
                  >
                    {/* Timeline dot */}
                    <div className="absolute -left-[25px] top-3 w-3 h-3 rounded-full bg-white border-2 border-[#154212]" />

                    {item.type === 'reward' ? (
                      /* Rich reward / donation card */
                      <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-[#e5e5e5]">
                        <div className={cn('w-10 h-10 rounded-full flex-shrink-0', item.color)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#154212] font-medium mb-0.5">{formatTime(item.time)}</p>
                          <p className="text-sm font-medium text-[#444444] mb-1.5">
                            {item.title} {item.quantity ? `× ${item.quantity}` : ''}
                          </p>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-[#666666]">อัพเดต {item.date} {formatTime(item.time)}</p>
                            <span className="text-xs bg-[#f5f5f5] rounded px-2 py-0.5 text-[#444444] flex-shrink-0">
                              จำนวน {item.quantity ?? 1}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#666666] truncate">
                              สถานะ : {item.status || 'เตรียมจัดส่งในรอบถัดไป'}
                            </p>
                            <p className="text-sm font-bold text-[#c06161] flex-shrink-0 ml-2">
                              -{(item.pointsSpent ?? 0).toLocaleString()} คะแนน
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Simple recycle / points card */
                      <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#e5e5e5]">
                        <div className={cn('w-10 h-10 rounded-full flex-shrink-0', item.color)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#154212] font-medium mb-0.5">{formatTime(item.time)}</p>
                          <p className="text-sm text-[#444444]">{item.title}</p>
                        </div>

                        {/* Three-dot menu (recycle detail) */}
                        {item.hasDetail && (
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                              className="p-1 rounded-full hover:bg-[#f5f5f5]"
                            >
                              <MoreVertical className="w-5 h-5 text-[#999999]" />
                            </button>

                            {openMenuId === item.id && (
                              <div className="absolute right-0 top-8 bg-white border border-[#e5e5e5] rounded-lg shadow-lg z-10 py-1 min-w-[160px]">
                                <Link
                                  href={`/history/${item.id}`}
                                  className="block px-4 py-2 text-sm text-[#444444] hover:bg-[#f5f5f5]"
                                  onClick={() => setOpenMenuId(null)}
                                >
                                  ดูรายละเอียด
                                </Link>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* <BottomNav /> */}
    </div>
  )
}
