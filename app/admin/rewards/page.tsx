'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, ArrowLeft } from 'lucide-react'
import { REWARDS } from '@/lib/waste-data'
import { useAdmin } from '@/lib/admin-context'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface RewardItem {
  id: number
  name: string
  description: string
  points: number
  image: string
  enabled: boolean
  stock: number | null
}

export default function AdminRewardsPage() {
  const { isAdmin } = useAdmin()
  const router = useRouter()

  const [items, setItems] = useState<RewardItem[]>(
    REWARDS.map((r) => ({
      ...r,
      enabled: true,
      stock: 75,
    }))
  )

  // Redirect non-admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3 px-6">
        <p className="text-[#154212] font-semibold text-center">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-[#154212]/60 hover:text-[#154212] underline"
        >
          กลับ
        </button>
      </div>
    )
  }

  const toggleEnabled = (id: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      )
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-black/10 z-40">
        <div className="max-w-md mx-auto flex items-center h-[50px] px-4 gap-3">
          <button onClick={() => router.back()} className="text-[#154212]" aria-label="กลับ">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-[#154212]">ของรางวัล</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 pb-24 space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-[#e5e5e5] flex items-center gap-3 px-4 py-3"
          >
            {/* Image */}
            <div className="relative w-[68px] h-[68px] rounded-xl overflow-hidden bg-[#f5f5f5] flex-shrink-0">
              <Image src={item.image} alt={item.name} fill className="object-cover" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#154212] truncate">{item.name}</p>
              <p className="text-xs text-[#666] mt-0.5">{item.description}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-[#154212]">{item.points} คะแนน</span>
                {item.enabled ? (
                  <span className="text-xs text-[#154212]">
                    &bull; จำนวนคงเหลือ {item.stock ?? '–'}
                  </span>
                ) : (
                  <span className="text-xs text-white bg-[#999] px-2 py-0.5 rounded-full">
                    ของหมด
                  </span>
                )}
              </div>
            </div>

            {/* Toggle */}
            <button
              onClick={() => toggleEnabled(item.id)}
              aria-label={item.enabled ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                item.enabled ? 'bg-[#154212]' : 'bg-[#d1d5db]'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  item.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>
        ))}
      </main>

      {/* FAB */}
      <Link
        href="/admin/rewards/new"
        className="fixed bottom-8 right-6 w-14 h-14 rounded-full bg-[#154212] text-white flex items-center justify-center shadow-lg hover:bg-[#0d3308] transition-colors"
        aria-label="เพิ่มของรางวัล"
      >
        <Plus className="w-7 h-7" />
      </Link>
    </div>
  )
}
