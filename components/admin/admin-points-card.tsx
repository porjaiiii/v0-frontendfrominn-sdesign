'use client'

import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'

import { apiFetch } from '@/lib/api-client'

type State =
  | { status: 'loading' }
  | { status: 'ready'; points: number }
  | { status: 'error' }

/**
 * Somebody else's spendable points, for staff.
 *
 * Reads /api/admin/points (admin session cookie), not /api/points — that one
 * serves only the caller's own account and answers 403 for anyone else's id.
 *
 * Bump `refreshKey` to reload — e.g. after confirming a record awards points.
 */
export function AdminPointsCard({ userId, refreshKey = 0 }: { userId: string; refreshKey?: number }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    setState({ status: 'loading' })

    apiFetch(`/api/admin/points?user_id=${encodeURIComponent(userId)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setState({ status: 'ready', points: Number(data.account?.total_points ?? 0) })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('[AdminPointsCard] failed to load points:', error)
        setState({ status: 'error' })
      })

    return () => controller.abort()
  }, [userId, refreshKey])

  return (
    <div className="bg-gradient-to-r from-[#fff4c2] to-[#b6ebad] rounded-xl p-4">
      <p className="text-xs text-[#154212] mb-1">คะแนนสะสมที่ใช้ได้</p>
      <div className="flex items-baseline gap-1">
        {state.status === 'error' ? (
          <span className="text-sm text-[#f44336]">ไม่สามารถโหลดคะแนนได้</span>
        ) : (
          <>
            <span className="text-4xl font-bold text-[#154212]">
              {state.status === 'ready' ? state.points.toLocaleString('en-US') : '…'}
            </span>
            <span className="text-lg text-[#154212]">คะแนน</span>
          </>
        )}
        <Coins className="w-6 h-6 text-[#154212] ml-auto self-center" />
      </div>
    </div>
  )
}
