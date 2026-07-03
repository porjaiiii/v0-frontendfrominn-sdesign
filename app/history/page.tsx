'use client'

import { PageHeader } from '@/components/page-header'
import { ChevronLeft, MoreVertical, Recycle, Gift, Coins, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import { useLiffContext } from '@/lib/liff-context'
import {
  mapWasteRecords,
  wasteTypeName,
  wasteSubtypeName,
  type WasteRecord,
} from '@/lib/waste-records'
import type { Coupon } from '@/lib/coupon-context'

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
  { id: 'points', label: 'คะแนน', icon: Coins, color: TYPE_COLOR.points },
  { id: 'recycle', label: 'รีไซเคิล', icon: Recycle, color: TYPE_COLOR.recycle },
  { id: 'reward', label: 'แลกรางวัล', icon: Gift, color: TYPE_COLOR.reward },
]

type HistoryItem = {
  id: string
  ts?: number         // epoch ms, for chronological sorting across sources
  date: string
  time: string
  type: string        // 'recycle' | 'points' | 'reward'
  title: string
  color: string
  // recycle-specific (from the trash-side submission sheet)
  image?: string      // first uploaded photo, shown as a thumbnail
  subtitle?: string   // short topic: weight + points earned
  detailId?: string   // encoded record timestamp -> /history/[id]
  // points-specific
  pointsEarned?: number
  // reward-specific (from spend_details)
  quantity?: number
  status?: string
  pointsSpent?: number
  category?: 'reward' | 'donate'
  txId?: string       // links a reward row to its coupon (shared key)
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

// Trash-side submission record -> rich recycle entry (type/subtype, weight,
// points, photo). This is the source for the recycle timeline + its detail page.
function wasteToHistoryItem(r: WasteRecord): HistoryItem {
  const d = parseTs(r.timestamp)
  const typeName = wasteTypeName(r.waste_type)
  const subName = wasteSubtypeName(r.waste_type, r.waste_subtype)
  const weight = Math.round(r.weight_kg * 100) / 100
  const points = Math.round(r.points_earned)
  const hasWeight = r.weight_kg > 0
  return {
    id: `waste-${r.timestamp}`,
    ts: d.getTime(),
    date: fmtDate(d),
    time: fmtTime(d),
    type: 'recycle',
    title: subName ? `${typeName} · ${subName}` : typeName,
    color: TYPE_COLOR.recycle,
    image: r.image_urls[0],
    subtitle: `${hasWeight ? `${weight} KG · ` : ''}+${points.toLocaleString()} คะแนน`,
    detailId: encodeURIComponent(r.timestamp),
    pointsEarned: points,
  }
}

// Each recycling record also appears in the คะแนน tab as a point-gain entry,
// reusing the same points_earned shown on its recycle card. Sourced from the
// waste records so the tab always mirrors what shows under รีไซเคิล.
function recycleItemToPointItem(r: HistoryItem): HistoryItem {
  const points = r.pointsEarned ?? 0
  return {
    ...r,
    id: `pt-${r.id}`,
    type: 'points',
    title: `คุณได้รับ +${points.toLocaleString()} คะแนน`,
    color: TYPE_COLOR.points,
    image: undefined,
    subtitle: undefined,
    detailId: undefined,
  }
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
    txId: d.tx_id,
  }
}

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

// Newest first. A recycle entry and its mirrored points entry share the same
// timestamp, so the tie-break (recycle before points) keeps คะแนน right after
// the รีไซเคิล it came from.
const TYPE_ORDER: Record<string, number> = { recycle: 0, points: 1, reward: 2 }
const byTsDesc = (a: HistoryItem, b: HistoryItem) =>
  (b.ts ?? 0) - (a.ts ?? 0) ||
  (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9)

export default function HistoryPage() {
  const router = useRouter()
  const { profile: liffProfile } = useLiffContext()
  const [activeFilter, setActiveFilter] = useState('all')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [spendDetails, setSpendDetails] = useState<SpendDetailRow[] | null>(null)
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[] | null>(null)
  const [coupons, setCoupons] = useState<Coupon[] | null>(null)

  // Pull this user's spend details, waste submissions (for photos + type
  // detail + earned points) and coupons (to link reward rows).
  useEffect(() => {
    const userId = liffProfile?.userId
    if (!userId) return
    const controller = new AbortController()
    const q = encodeURIComponent(userId)

    fetch(`/api/points?action=get_spend_details&user_id=${q}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setSpendDetails(data?.success ? (data.details as SpendDetailRow[]) : []))
      .catch(err => { if (err.name !== 'AbortError') setSpendDetails([]) })

    fetch(`/api/waste/records?user_id=${q}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setWasteRecords(mapWasteRecords(data?.records ?? [], userId)))
      .catch(err => { if (err.name !== 'AbortError') setWasteRecords([]) })

    fetch(`/api/coupons?user_id=${q}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setCoupons(data?.success ? (data.coupons as Coupon[]) : []))
      .catch(err => { if (err.name !== 'AbortError') setCoupons([]) })

    return () => controller.abort()
  }, [liffProfile?.userId])

  // Recycle entries from the trash sheet (only confirmed/"done" submissions);
  // reward entries from spend_details; point-gain entries mirror the recycle
  // records (each recycling event = points earned).
  const recycleItems = (wasteRecords ?? [])
    .filter(r => r.status === 'done')
    .map(wasteToHistoryItem)
  const rewardItems = (spendDetails ?? []).map(spendDetailToItem)
  const pointItems = recycleItems
    .filter(r => (r.pointsEarned ?? 0) > 0)
    .map(recycleItemToPointItem)

  // tx_id -> coupon, so a reward row can link to (and reflect the status of) its coupon.
  const couponByTx = new Map<string, Coupon>()
  for (const c of coupons ?? []) {
    if (c.tx_id) couponByTx.set(c.tx_id, c)
  }

  // Still waiting on any of the source fetches for a logged-in user.
  const isLoading =
    !!liffProfile?.userId &&
    (spendDetails === null || wasteRecords === null || coupons === null)

  const filteredData =
    activeFilter === 'recycle' ? [...recycleItems].sort(byTsDesc)
    : activeFilter === 'reward' ? [...rewardItems].sort(byTsDesc)
    : activeFilter === 'points' ? [...pointItems].sort(byTsDesc)
    // "all": recycle + its mirrored points entry (points shown right after the
    // recycle it came from) + rewards, newest first.
    : [...recycleItems, ...pointItems, ...rewardItems].sort(byTsDesc)

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

        {/* Loading skeleton — only while we still have nothing to show. As soon
            as any source resolves, the real list below renders and the skeleton
            drops, so a slow/hanging fetch can't keep it on screen. */}
        {isLoading && filteredData.length === 0 && (
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
                  <div key={item.id} className="relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-[25px] top-3 w-3 h-3 rounded-full bg-white border-2 border-[#154212]" />

                    {item.type === 'reward' ? (
                      <RewardCard item={item} coupon={item.txId ? couponByTx.get(item.txId) : undefined} />
                    ) : item.type === 'recycle' ? (
                      /* Recycle card — photo thumbnail + short topic + detail menu */
                      <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#e5e5e5]">
                        {item.image ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 relative bg-[#f0f0f0]">
                            <Image src={item.image} alt="รูปขยะ" fill className="object-cover" />
                          </div>
                        ) : (
                          <div className={cn('w-10 h-10 rounded-full flex-shrink-0', item.color)} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#154212] font-medium mb-0.5">{formatTime(item.time)}</p>
                          <p className="text-sm text-[#444444] truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-xs text-[#666666] mt-0.5">{item.subtitle}</p>
                          )}
                        </div>

                        {/* Three-dot menu (recycle detail) */}
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
                                href={`/history/${item.detailId}`}
                                className="block px-4 py-2 text-sm text-[#444444] hover:bg-[#f5f5f5]"
                                onClick={() => setOpenMenuId(null)}
                              >
                                ดูรายละเอียด
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Points card — a point-gain entry */
                      <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#e5e5e5]">
                        <div className={cn('w-10 h-10 rounded-full flex-shrink-0', item.color)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#154212] font-medium mb-0.5">{formatTime(item.time)}</p>
                          <p className="text-sm text-[#444444]">{item.title}</p>
                        </div>
                        <p className="text-sm font-bold text-[#157b03] flex-shrink-0">
                          +{(item.pointsEarned ?? 0).toLocaleString()}
                        </p>
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

// Reward / donation card. When the row has an active coupon it becomes a link
// to that coupon; a used/expired coupon is shown but not clickable.
function RewardCard({ item, coupon }: { item: HistoryItem; coupon?: Coupon }) {
  const isReward = item.category === 'reward'
  const isActiveCoupon = isReward && coupon?.status === 'active'
  const isUsedCoupon = isReward && coupon?.status === 'used'
  const isExpiredCoupon = isReward && coupon?.status === 'expired'

  // The spend_details status column is unreliable for rewards (coupon usage
  // lives in a different sheet), so the coupon is the source of truth. Every
  // reward row gets coupon wording; only donations keep their own status.
  let statusLabel = item.status
  if (isReward) {
    if (isUsedCoupon) statusLabel = 'ใช้คูปองแล้ว'
    else if (isExpiredCoupon) statusLabel = 'คูปองหมดอายุ'
    else statusLabel = 'รอใช้งานคูปอง' // active coupon, or none matched yet
  }

  const card = (
    <div
      className={cn(
        'flex items-start gap-3 p-3 bg-white rounded-xl border border-[#e5e5e5]',
        (isUsedCoupon || isExpiredCoupon) && 'opacity-70',
        isActiveCoupon && 'hover:border-[#154212] transition-colors'
      )}
    >
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
          <p
            className={cn(
              'text-xs truncate flex items-center gap-0.5',
              isActiveCoupon ? 'text-[#157b03] font-medium' : 'text-[#666666]'
            )}
          >
            สถานะ : {statusLabel}
            {isActiveCoupon && <ChevronRight className="w-3.5 h-3.5" />}
          </p>
          <p className="text-sm font-bold text-[#c06161] flex-shrink-0 ml-2">
            -{(item.pointsSpent ?? 0).toLocaleString()} คะแนน
          </p>
        </div>
      </div>
    </div>
  )

  if (isActiveCoupon && coupon) {
    return (
      <Link href={`/coupons/${coupon.coupon_id}`} className="block">
        {card}
      </Link>
    )
  }
  return card
}
