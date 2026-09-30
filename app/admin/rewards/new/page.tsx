'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/lib/admin-context'
import { RewardForm, type RewardFormValues } from '@/components/admin/reward-form'

export default function AdminAddRewardPage() {
  const { isAdmin } = useAdmin()
  const router = useRouter()

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3 px-6">
        <p className="text-[#154212] font-semibold text-center">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        <button onClick={() => router.back()} className="text-sm text-[#154212]/60 underline">
          กลับ
        </button>
      </div>
    )
  }

  const handleSubmit = async (values: RewardFormValues) => {
    const res = await fetch('/api/catalog/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.success) {
      throw new Error(data?.error ?? 'ไม่สามารถเพิ่มของรางวัลได้')
    }

    router.back()
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-black/10 z-40">
        <div className="max-w-md mx-auto flex items-center h-[50px] px-4 gap-3">
          <button onClick={() => router.back()} className="text-[#154212]" aria-label="กลับ">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-[#154212]">เพิ่มรายการของรางวัล</h1>
        </div>
      </header>

      <RewardForm onSubmit={handleSubmit} />
    </div>
  )
}
