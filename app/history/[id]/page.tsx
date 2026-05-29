'use client'

import Image from 'next/image'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { ChevronLeft, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'

// Mock data for the detail page
const recycleDetail = {
  id: '1',
  type: 'ขวดน้ำพลาสติกใส (PET)',
  weight: 4.53,
  totalWeight: 4.53,
  pointsEarned: 21,
  image: '/placeholder.jpg',
  date: '27 พฤษภาคม 2569',
  totalPoints: 67,
}

export default function HistoryDetailPage() {
  const router = useRouter()

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
              <span className="text-[#666666]">{recycleDetail.type}</span>
              <span className="font-medium text-[#154212]">{recycleDetail.weight} Kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#666666]">น้ำหนักรวม</span>
              <span className="font-medium text-[#154212]">{recycleDetail.totalWeight} Kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#666666]">คะแนนสะสมที่ได้รับ</span>
              <span className="font-medium text-[#154212]">{recycleDetail.pointsEarned} คะแนน</span>
            </div>
          </div>
        </div>

        {/* Photo Evidence Section */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-[#154212] mb-3">รูปภาพ</h2>
          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#e5e5e5]">
            <Image
              src={recycleDetail.image}
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
              <span className="text-sm">{recycleDetail.date}</span>
            </div>
            <p className="text-base font-semibold text-[#154212]">
              ยอดคะแนนสะสม {recycleDetail.totalPoints} คะแนน
            </p>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
