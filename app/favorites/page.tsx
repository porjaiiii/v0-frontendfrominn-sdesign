'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, ArrowLeft, CheckCircle2, Ticket } from 'lucide-react'
import { motion } from 'framer-motion'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { REWARDS } from '@/lib/waste-data'
import { cn } from '@/lib/utils'
import { usePoints } from '@/lib/points-context'
import { useCoupons } from '@/lib/coupon-context'

export default function FavoritesPage() {
  const { points: userPoints, loading: pointsLoading, spendPoints } = usePoints()
  const { addCoupon } = useCoupons()
  const [favorites, setFavorites] = useState<Set<number>>(new Set())

  // Direct "แลกเลย" redeem states & refs
  const [redeemTarget, setRedeemTarget] = useState<typeof REWARDS[number] | null>(null)
  const [processing, setProcessing] = useState(false)
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [redeemSuccess, setRedeemSuccess] = useState(false)
  const [newCouponId, setNewCouponId] = useState<string | null>(null)
  
  // Guard system against double-tap fast click
  const redeemInFlight = useRef(false)

  useEffect(() => {
    const saved = localStorage.getItem('favorites')
    if (saved) {
      try {
        setFavorites(new Set(JSON.parse(saved)))
      } catch (e) {
        console.error('Failed to load favorites:', e)
      }
    }
  }, [])

  const toggleFavorite = (id: number) => {
    const newFavorites = new Set(favorites)
    if (newFavorites.has(id)) {
      newFavorites.delete(id)
    } else {
      newFavorites.add(id)
    }
    setFavorites(newFavorites)
    localStorage.setItem('favorites', JSON.stringify(Array.from(newFavorites)))
  }

  // Redeem handlers
  const openRedeem = (reward: typeof REWARDS[number]) => {
    setRedeemTarget(reward)
    setRedeemError(null)
    setRedeemSuccess(false)
    setNewCouponId(null)
  }

  const handleConfirmRedeem = async () => {
    if (!redeemTarget) return
    if (redeemInFlight.current) return
    setRedeemError(null)

    if (redeemTarget.points > userPoints) {
      setRedeemError('คะแนนของคุณไม่เพียงพอ')
      return
    }

    redeemInFlight.current = true
    setProcessing(true)

    try {
      const result = await spendPoints(redeemTarget.points, {
        category: 'reward',
        items: [{ name: redeemTarget.name, quantity: 1, points: redeemTarget.points }],
      })

      if (result.success) {
        try {
          const payload = {
            reward_id: redeemTarget.id,
            reward_name: redeemTarget.name,
            reward_description: redeemTarget.description ?? '',
            reward_image: redeemTarget.image,
            points_used: redeemTarget.points,
            tx_id: result.tx_id,
          }

          const coupon = await addCoupon(payload)
          setNewCouponId(coupon.coupon_id)
          setRedeemSuccess(true)
        } catch (err) {
          console.error('[Favorites] addCoupon — error:', err)
          setRedeemError('แลกคะแนนสำเร็จ แต่ไม่สามารถสร้างคูปองได้ กรุณาติดต่อเจ้าหน้าที่')
        }
      } else {
        setRedeemError(result.message || 'ไม่สามารถแลกของรางวัลได้ กรุณาลองใหม่')
      }
    } finally {
      redeemInFlight.current = false
      setProcessing(false)
    }
  }

  const favoriteRewards = REWARDS.filter(reward => favorites.has(reward.id))

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/rewards" className="flex items-center gap-2 text-[#154212] hover:text-[#0d3308]">
            <ArrowLeft size={20} />
            <span className="font-semibold">รายการที่ถูกใจ</span>
          </Link>
          <div className="text-sm text-[#154212] font-medium">
            คะแนนของคุณ: {pointsLoading ? '…' : userPoints.toLocaleString()} P
          </div>
        </div>

        {/* Empty State */}
        {favoriteRewards.length === 0 ? (
          <div className="text-center py-12">
            <Heart size={48} className="mx-auto mb-4 text-[#e5e5e5]" />
            <p className="text-[#999999] text-sm">ยังไม่มีรายการที่ถูกใจ</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {favoriteRewards.map((reward) => {
              const canRedeem = userPoints >= reward.points
              const isFavorited = favorites.has(reward.id)

              return (
                <div
                  key={reward.id}
                  className={cn(
                    'bg-white rounded-xl border overflow-hidden transition-all relative',
                    canRedeem 
                      ? 'border-[#e5e5e5] hover:shadow-md' 
                      : 'border-[#e5e5e5]'
                  )}
                >
                  {/* Favorite Heart */}
                  <button
                    onClick={() => toggleFavorite(reward.id)}
                    className="absolute top-2 right-2 z-10 transition-transform hover:scale-110"
                    title="ลบออกจากรายการโปรด"
                  >
                    <Heart
                      size={20}
                      className={cn(
                        isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-300'
                      )}
                    />
                  </button>

                  {/* Product Image */}
                  <div className="aspect-square relative bg-[#f5f5f5]">
                    <Image
                      src={reward.image}
                      alt={reward.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-[#444444] mb-1 line-clamp-1">
                      {reward.name}
                    </h3>
                    {reward.description && (
                      <p className="text-xs text-[#666666] mb-2 line-clamp-1">{reward.description}</p>
                    )}
                    <div className="flex items-center justify-between mb-3">
                      <span className={cn(
                        'text-sm font-semibold',
                        canRedeem ? 'text-[#157b03]' : 'text-[#999999]'
                      )}>
                        {reward.points.toLocaleString()} แต้ม
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openRedeem(reward)}
                        disabled={!canRedeem || pointsLoading}
                        className={cn(
                          'w-full py-2 rounded-lg text-sm font-medium transition-colors',
                          canRedeem
                            ? 'bg-[#154212] text-white hover:bg-[#0d3308]'
                            : 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
                        )}
                      >
                        แลกเลย
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Direct redeem modal (แลกเลย — single item Sheet) */}
      {redeemTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => setRedeemTarget(null)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {redeemSuccess ? (
              <div className="flex flex-col items-center text-center py-4">
                <div className="w-16 h-16 rounded-full bg-[#e8f5e2] flex items-center justify-center mb-3">
                  <CheckCircle2 size={40} className="text-[#157b03]" />
                </div>
                <h2 className="text-xl font-bold text-[#154212] mb-1">แลกรางวัลเสร็จสิ้น!</h2>
                <p className="text-sm text-[#666666] mb-1">
                  {redeemTarget.name} · ใช้ไป {redeemTarget.points.toLocaleString()} คะแนน
                </p>
                <p className="text-sm text-[#666666] mb-6">
                  คะแนนคงเหลือ {userPoints.toLocaleString()} คะแนน
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setRedeemTarget(null)}
                    className="flex-1 py-3 border-2 border-[#154212] text-[#154212] font-bold rounded-xl hover:bg-[#f5f5f5] transition-colors"
                  >
                    เสร็จสิ้น
                  </button>
                  <Link
                    href="/coupons"
                    onClick={() => setRedeemTarget(null)}
                    className="flex-1 py-3 bg-[#154212] text-white font-bold rounded-xl hover:bg-[#0d3308] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Ticket size={16} />
                    ดูคูปองของฉัน
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 relative bg-[#f5f5f5] rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={redeemTarget.image} alt={redeemTarget.name} fill className="object-cover" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#154212]">{redeemTarget.name}</h2>
                    <p className="text-sm text-[#157b03] font-semibold">{redeemTarget.points.toLocaleString()} คะแนน</p>
                  </div>
                </div>
                <p className="text-sm text-[#666666] mb-1">ยืนยันการแลกของรางวัลนี้?</p>
                <p className="text-sm font-semibold text-[#154212] mb-4">
                  คะแนนของคุณ: {pointsLoading ? '…' : userPoints.toLocaleString()} คะแนน
                </p>

                {redeemError && (
                  <div className="text-xs text-[#cc0000] bg-[#fff0f0] border border-[#ffb3b3] rounded-lg px-3 py-2 mb-3">
                    {redeemError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setRedeemTarget(null)}
                    disabled={processing}
                    className="flex-1 py-3 border-2 border-[#e5e5e5] text-[#154212] font-bold rounded-lg hover:bg-[#f5f5f5] transition-colors disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleConfirmRedeem}
                    disabled={processing || pointsLoading}
                    className={cn(
                      'flex-1 py-3 font-bold rounded-lg transition-colors',
                      processing || pointsLoading
                        ? 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
                        : 'bg-[#154212] text-white hover:bg-[#0d3308]'
                    )}
                  >
                    {processing ? 'กำลังแลก…' : 'ยืนยัน'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* <BottomNav /> */}
    </div>
  )
}