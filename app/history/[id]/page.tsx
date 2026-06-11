'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { ChevronLeft, Calendar } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { useLiffContext } from '@/lib/liff-context'
import { usePoints } from '@/lib/points-context'
import { MOCK_USER } from '@/lib/mock-user'

type Transaction = {
  tx_id: string
  type: string
  points: number
  co2: number
  weight?: number
  timestamp: string
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

function formatThaiDate(ts: string): string {
  const d = new Date(String(ts).replace(' ', 'T'))
  if (isNaN(d.getTime())) return ts
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

// Mock detail used when the id isn't a real transaction (or no history yet).
const mockDetail = {
  type: 'ขวดน้ำพลาสติกใส (PET)',
  weight: 4.53,
  totalWeight: 4.53,
  pointsEarned: 21,
  image: '/placeholder.jpg',
  date: '27 พฤษภาคม 2569',
  totalPoints: MOCK_USER.points,
}

export default function HistoryDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const { profile: liffProfile } = useLiffContext()
  const { points: accountPoints } = usePoints()

  const [tx, setTx] = useState<Transaction | null>(null)

  useEffect(() => {
    const userId = liffProfile?.userId
    if (!userId || !id) return
    const controller = new AbortController()
    fetch(`/api/points?action=get_transactions&user_id=${encodeURIComponent(userId)}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (data?.success) {
          const found = (data.transactions as Transaction[]).find(t => t.tx_id === id)
          if (found) setTx(found)
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [liffProfile?.userId, id])

  // Real transaction when found, otherwise the mock figures.
  const detail = tx
    ? {
        type: 'ของรีไซเคิล',
        weight: Number(tx.weight) || 0,
        totalWeight: Number(tx.weight) || 0,
        pointsEarned: tx.points,
        image: '/placeholder.jpg',
        date: formatThaiDate(tx.timestamp),
        totalPoints: accountPoints,
      }
    : mockDetail

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Back Button and Title */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => router.back()}
            className="p-1 rounded-full hover:bg-[#f5f5f5]"
          >
            <ChevronLeft className="w-6 h-6 text-[#666666]" />
          </button>
          <h1 className="text-lg font-semibold text-[#154212]">รายการเก็บของรีไซเคิล</h1>
        </div>

        {/* Detail Card */}
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 mb-6">
          <h2 className="text-base font-semibold text-[#154212] mb-3">รายการของรีไซเคิล</h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#666666]">{detail.type}</span>
              <span className="font-medium text-[#154212]">{detail.weight} Kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#666666]">น้ำหนักรวม</span>
              <span className="font-medium text-[#154212]">{detail.totalWeight} Kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#666666]">คะแนนสะสมที่ได้รับ</span>
              <span className="font-medium text-[#154212]">{detail.pointsEarned} คะแนน</span>
            </div>
          </div>
        </div>

        {/* Photo Evidence Section */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-[#154212] mb-3">รูปภาพ</h2>
          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#e5e5e5]">
            <Image
              src={detail.image}
              alt="รูปภาพหลักฐาน"
              fill
              className="object-cover"
            />
          </div>
        </div>

        {/* Points Summary Section */}
        <div>
          <h2 className="text-base font-semibold text-[#154212] mb-3">ยอดคะแนนสะสม</h2>
          <div className="bg-gradient-to-r from-[#91c1e7] to-[#9fcba5] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#154212] mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">{detail.date}</span>
            </div>
            <p className="text-base font-semibold text-[#154212]">
              ยอดคะแนนสะสม {detail.totalPoints} คะแนน
            </p>
          </div>
        </div>
      </main>

      {/* <BottomNav /> */}
    </div>
  )
}
