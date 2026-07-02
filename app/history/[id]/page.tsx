'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { ChevronLeft, Calendar, AlertCircle } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { useLiffContext } from '@/lib/liff-context'
import { usePoints } from '@/lib/points-context'
import {
  mapWasteRecords,
  wasteTypeName,
  wasteSubtypeName,
  type WasteRecord,
} from '@/lib/waste-records'

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

function formatThaiDate(ts: string): string {
  const d = new Date(String(ts).replace(' ', 'T'))
  if (isNaN(d.getTime())) return ts
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

export default function HistoryDetailPage() {
  const router = useRouter()
  const params = useParams()
  // The route id is the waste record's timestamp (URL-decoded by Next).
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const { profile: liffProfile } = useLiffContext()
  const { points: accountPoints } = usePoints()

  const [record, setRecord] = useState<WasteRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userId = liffProfile?.userId
    if (!userId || !id) return
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/waste/records?user_id=${encodeURIComponent(userId)}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        const records = mapWasteRecords(data?.records ?? [], userId)
        const found = records.find(r => r.timestamp === id)
        setRecord(found ?? null)
      })
      .catch(err => { if (err.name !== 'AbortError') setRecord(null) })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [liffProfile?.userId, id])

  const typeName = record ? wasteTypeName(record.waste_type) : ''
  const subName = record ? wasteSubtypeName(record.waste_type, record.waste_subtype) : ''
  const weight = record ? Math.round(record.weight_kg * 100) / 100 : 0
  const hasWeight = !!record && record.weight_kg > 0
  const points = record ? Math.round(record.points_earned) : 0
  const co2 = record ? Math.round(record.carbon_reduction * 100) / 100 : 0
  const images = record?.image_urls ?? []

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

        {loading ? (
          <div className="space-y-6">
            <div className="h-32 bg-[#f0f0f0] rounded-xl animate-pulse" />
            <div className="aspect-video bg-[#f0f0f0] rounded-xl animate-pulse" />
          </div>
        ) : !record ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-[#c06161]" />
            <p className="text-sm text-[#999999]">ไม่พบรายการนี้</p>
          </div>
        ) : (
          <>
            {/* Detail Card */}
            <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 mb-6">
              <h2 className="text-base font-semibold text-[#154212] mb-3">รายการของรีไซเคิล</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#666666]">ประเภท</span>
                  <span className="font-medium text-[#154212]">{typeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666666]">ชนิด</span>
                  <span className="font-medium text-[#154212]">{subName || '-'}</span>
                </div>
                {hasWeight && (
                  <div className="flex justify-between">
                    <span className="text-[#666666]">น้ำหนัก</span>
                    <span className="font-medium text-[#154212]">{weight} Kg</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#666666]">ลดคาร์บอนได้</span>
                  <span className="font-medium text-[#154212]">{co2} kgCO₂</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666666]">คะแนนสะสมที่ได้รับ</span>
                  <span className="font-medium text-[#154212]">{points.toLocaleString()} คะแนน</span>
                </div>
              </div>
            </div>

            {/* Photo Evidence Section */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-[#154212] mb-3">รูปภาพ</h2>
              {images.length > 0 ? (
                <div className={images.length > 1 ? 'grid grid-cols-2 gap-2' : ''}>
                  {images.map((url, i) => (
                    <div
                      key={i}
                      className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#e5e5e5] bg-[#f5f5f5]"
                    >
                      <Image src={url} alt={`รูปภาพหลักฐานที่ ${i + 1}`} fill className="object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full aspect-video rounded-xl border border-dashed border-[#e5e5e5] flex items-center justify-center bg-[#fafafa]">
                  <p className="text-sm text-[#999999]">ไม่มีรูปภาพ</p>
                </div>
              )}
            </div>

            {/* Points Summary Section */}
            <div>
              <h2 className="text-base font-semibold text-[#154212] mb-3">ยอดคะแนนสะสม</h2>
              <div className="bg-gradient-to-r from-[#91c1e7] to-[#9fcba5] rounded-xl p-4">
                <div className="flex items-center gap-2 text-[#154212] mb-2">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">{formatThaiDate(record.timestamp)}</span>
                </div>
                <p className="text-base font-semibold text-[#154212]">
                  ยอดคะแนนสะสม {accountPoints.toLocaleString()} คะแนน
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      {/* <BottomNav /> */}
    </div>
  )
}
