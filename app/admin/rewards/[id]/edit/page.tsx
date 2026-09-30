'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useAdmin } from '@/lib/admin-context'
import { RewardForm, type RewardFormValues } from '@/components/admin/reward-form'

interface AdminReward {
  id: number
  name: string
  description: string
  points: number
  image: string
  isVariable: boolean
  stock: number | null
}

export default function AdminEditRewardPage() {
  const { isAdmin } = useAdmin()
  const router = useRouter()
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : params.id

  // GET /api/catalog/rewards/[id] (admin only) — includes switched-off rewards.
  const [reward, setReward] = useState<AdminReward | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin || !id) return
    let cancelled = false
    fetch(`/api/catalog/rewards/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.success || !data.reward) {
          throw new Error(data?.error ?? 'ไม่สามารถโหลดของรางวัลได้')
        }
        return data.reward as AdminReward
      })
      .then((loaded) => {
        if (!cancelled) setReward(loaded)
      })
      .catch((err) => {
        console.error('[admin/rewards/edit] load failed:', err)
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'ไม่สามารถโหลดของรางวัลได้')
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin, id])

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

  // PATCH /api/catalog/rewards/[id] — only the fields the form produced.
  const handleSubmit = async (values: RewardFormValues) => {
    const res = await fetch(`/api/catalog/rewards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.success) {
      throw new Error(data?.error ?? 'ไม่สามารถบันทึกของรางวัลได้')
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
          <h1 className="text-base font-semibold text-[#154212]">แก้ไขของรางวัล</h1>
        </div>
      </header>

      {loadError ? (
        <p className="text-sm text-red-600 text-center py-6">{loadError}</p>
      ) : !reward ? (
        <p className="text-sm text-[#666] text-center py-6">กำลังโหลด...</p>
      ) : (
        <RewardForm initial={reward} pointsLocked={reward.isVariable} onSubmit={handleSubmit} />
      )}
    </div>
  )
}
