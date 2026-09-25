'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, ArrowLeft } from 'lucide-react'
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

  // Live catalog including switched-off rewards — GET /api/catalog/rewards
  // ?includeInactive=1 (admin only). `enabled` mirrors app.rewards.is_active and
  // toggleEnabled below persists it via PATCH /api/catalog/rewards/[id].
  const [items, setItems] = useState<RewardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())
  const [toggleError, setToggleError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    fetch('/api/catalog/rewards?includeInactive=1')
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.success || !Array.isArray(data.rewards)) {
          throw new Error(data?.error ?? 'ไม่สามารถโหลดของรางวัลได้')
        }
        return data.rewards as (Omit<RewardItem, 'enabled'> & { isActive: boolean })[]
      })
      .then((rewards) => {
        if (cancelled) return
        setItems(rewards.map(({ isActive, ...r }) => ({ ...r, enabled: isActive })))
        setLoadError(null)
      })
      .catch((err) => {
        console.error('[admin/rewards] catalog fetch failed:', err)
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'ไม่สามารถโหลดของรางวัลได้')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

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

  const setEnabled = (id: number, enabled: boolean) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, enabled } : item)))

  const setPending = (id: number, pending: boolean) =>
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (pending) next.add(id)
      else next.delete(id)
      return next
    })

  // Optimistic: flip the switch now, roll it back if the PATCH fails.
  const toggleEnabled = async (item: RewardItem) => {
    if (pendingIds.has(item.id)) return
    const next = !item.enabled
    setToggleError(null)
    setEnabled(item.id, next)
    setPending(item.id, true)
    try {
      const res = await fetch(`/api/catalog/rewards/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? 'ไม่สามารถเปลี่ยนสถานะของรางวัลได้')
      }
    } catch (err) {
      setEnabled(item.id, item.enabled)
      setToggleError(err instanceof Error ? err.message : 'ไม่สามารถเปลี่ยนสถานะของรางวัลได้')
    } finally {
      setPending(item.id, false)
    }
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
        {loading && <p className="text-sm text-[#666] text-center py-6">กำลังโหลด...</p>}
        {loadError && <p className="text-sm text-red-600 text-center py-6">{loadError}</p>}
        {toggleError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">
            {toggleError}
          </p>
        )}
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
              onClick={() => toggleEnabled(item)}
              disabled={pendingIds.has(item.id)}
              role="switch"
              aria-checked={item.enabled}
              aria-label={item.enabled ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-60',
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
