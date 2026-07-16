'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, CheckCircle2, Ticket } from 'lucide-react'
import { motion } from 'framer-motion'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { REWARDS } from '@/lib/waste-data'
import { useCart } from '@/lib/cart-context'
import { cn } from '@/lib/utils'
import { usePoints } from '@/lib/points-context'
import { useCoupons } from '@/lib/coupon-context'

export default function RewardsPage() {
  const { points: userPoints, loading: pointsLoading, spendPoints } = usePoints()
  const { addToCart, cartCount } = useCart()
  const { addCoupon } = useCoupons()
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [mounted, setMounted] = useState(false)
  const [clickedButton, setClickedButton] = useState<number | null>(null)
  const buttonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({})
  const [showBadge, setShowBadge] = useState(false)

  // Direct "แลกเลย" redeem (single item, no cart)
  const [redeemTarget, setRedeemTarget] = useState<typeof REWARDS[number] | null>(null)
  const [processing, setProcessing] = useState(false)
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [redeemSuccess, setRedeemSuccess] = useState(false)
  const [newCouponId, setNewCouponId] = useState<string | null>(null)
  // Synchronous re-entry guard: the `disabled` attr only updates on re-render,
  // so a fast double-tap can fire the handler twice before React catches up.
  // This ref flips immediately and blocks the second call.
  const redeemInFlight = useRef(false)

  const openRedeem = (reward: typeof REWARDS[number]) => {
    setRedeemTarget(reward)
    setRedeemError(null)
    setRedeemSuccess(false)
    setNewCouponId(null)
  }

  const handleConfirmRedeem = async () => {
    if (!redeemTarget) return
    // Block re-entry synchronously — must run before any await so a second tap
    // in the same frame (or during the addCoupon step below) can't start a
    // second redeem and double-spend.
    if (redeemInFlight.current) return
    setRedeemError(null)

    console.log('[v0] handleConfirmRedeem — redeemTarget:', redeemTarget)
    console.log('[v0] handleConfirmRedeem — userPoints:', userPoints)

    if (redeemTarget.points > userPoints) {
      console.log('[v0] handleConfirmRedeem — not enough points, required:', redeemTarget.points, 'have:', userPoints)
      setRedeemError('คะแนนของคุณไม่เพียงพอ')
      return
    }

    redeemInFlight.current = true
    setProcessing(true)
    console.log('[v0] spendPoints — calling with amount:', redeemTarget.points, 'detail:', {
      category: 'reward',
      items: [{ name: redeemTarget.name, quantity: 1, points: redeemTarget.points }],
    })

    try {
      const result = await spendPoints(redeemTarget.points, {
        category: 'reward',
        items: [{ name: redeemTarget.name, quantity: 1, points: redeemTarget.points }],
      })

      console.log('[v0] spendPoints — result:', result)

      if (result.success) {
        console.log('[v0] spendPoints — success, tx_id:', result.tx_id)
        try {
          const payload = {
            reward_id: redeemTarget.id,
            reward_name: redeemTarget.name,
            reward_description: redeemTarget.description ?? '',
            reward_image: redeemTarget.image,
            points_used: redeemTarget.points,
            tx_id: result.tx_id,
          }
          console.log('[v0] addCoupon — calling with payload:', payload)

          const coupon = await addCoupon(payload)

          console.log('[v0] addCoupon — response coupon:', coupon)
          setNewCouponId(coupon.coupon_id)
          setRedeemSuccess(true)
        } catch (err) {
          console.error('[v0] addCoupon — error:', err)
          setRedeemError('แลกคะแนนสำเร็จ แต่ไม่สามารถสร้างคูปองได้ กรุณาติดต่อเจ้าหน้าที่')
        }
      } else {
        console.warn('[v0] spendPoints — failed:', result.message)
        setRedeemError(result.message || 'ไม่สามารถแลกของรางวัลได้ กรุณาลองใหม่')
      }
    } finally {
      // Keep the button disabled through the whole flow (spend + coupon), only
      // re-enabling once it's fully settled. On success the modal has already
      // switched to the success screen, so the confirm button is gone.
      redeemInFlight.current = false
      setProcessing(false)
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem('favorites')
    if (saved) {
      try {
        setFavorites(new Set(JSON.parse(saved)))
      } catch (e) {
        console.error('Failed to load favorites:', e)
      }
    }
    setMounted(true)
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

  const handleCartClick = (reward: any) => {
    addToCart({
      id: reward.id,
      name: reward.name,
      points: reward.points,
      image: reward.image
    })
    setClickedButton(reward.id)
    setShowBadge(true)
    setTimeout(() => setClickedButton(null), 200)
    setTimeout(() => setShowBadge(false), 600)
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Points Display Card */}
        <div className="bg-gradient-to-b from-[#154212] to-[#1a5a16] rounded-2xl p-5 mb-6 relative">
          {/* Icon Buttons - Top Right */}
          <div className="absolute top-4 right-4 flex gap-2">
            {/* Cart Button hidden for now — cart functionality disabled */}
            {/* <div className="relative">
              <Link
                href="/cart"
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors flex items-center justify-center"
                title="ดูตะกร้า"
              >
                <div className="relative w-5 h-5">
                  <Image src="/icons/tabler-icon-add-cart.png" alt="ตะกร้า" fill className="object-contain brightness-0 invert" />
                </div>
              </Link>
              {cartCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                >
                  {cartCount}
                </motion.div>
              )}
            </div> */}

            {/* Favorites Button */}
            <Link 
              href="/favorites"
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors flex items-center justify-center"
              title="รายการที่ถูกใจ"
            >
              <Heart size={20} />
            </Link>
          </div>

          <p className="text-sm text-white/80 mb-2">คะแนนสะสมของคุณ</p>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-5xl font-bold text-white">
              {pointsLoading ? '…' : userPoints.toLocaleString()}
            </span>
            <span className="text-lg text-white/80">คะแนน</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link 
              href="/history"
              className="px-4 py-1.5 bg-white rounded-lg text-sm font-medium text-[#154212] hover:bg-[#f5f5f5] transition-colors"
            >
              ประวัติการสะสมคะแนน
            </Link>
            <Link 
              href="/donate"
              className="px-4 py-1.5 bg-white rounded-lg text-sm font-medium text-[#154212] hover:bg-[#f5f5f5] transition-colors"
            >
              บริจาคคะแนน
            </Link>
          </div>
          <div className="mt-3">
            <Link
              href="/coupons"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium text-white transition-colors border border-white/30"
            >
              <Ticket size={15} />
              คูปองของฉัน
            </Link>
          </div>
        </div>

        {/* Rewards Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#154212]">รางวัลที่สามารถแลกได้</h2>
          
          <div className="grid grid-cols-2 gap-4">
            {REWARDS.map((reward) => {
              const canRedeem = userPoints >= reward.points
              const isFavorited = favorites.has(reward.id)
              const isClicked = clickedButton === reward.id

              return (
                <div
                  key={reward.id}
                  className={cn(
                    'bg-white rounded-xl border overflow-hidden transition-all relative flex flex-col',
                    canRedeem
                      ? 'border-[#e5e5e5] hover:shadow-md'
                      : 'border-[#e5e5e5]'
                  )}
                >
                  {/* Favorite Heart */}
                  <button
                    onClick={() => toggleFavorite(reward.id)}
                    className="absolute top-2 right-2 z-10 flex items-center justify-center p-1.5 rounded-full bg-white/70 backdrop-blur-sm shadow-sm transition-transform hover:scale-110"
                    title="เพิ่มสินค้าไปยังรายการโปรด"
                  >
                    <Heart
                      size={18}
                      className={cn(
                        isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400'
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
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="text-sm font-medium text-[#444444] mb-1 line-clamp-2">
                      {reward.name}
                    </h3>
                    {reward.description && (
                      <p className="text-xs text-[#666666] mb-2 line-clamp-2">{reward.description}</p>
                    )}
                    <div className="flex items-center justify-between mb-3 mt-auto">
                      <span className={cn(
                        'text-sm font-semibold',
                        canRedeem ? 'text-[#157b03]' : 'text-[#999999]'
                      )}>
                        {reward.points} แต้ม
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openRedeem(reward)}
                        disabled={!canRedeem}
                        className={cn(
                          'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                          canRedeem
                            ? 'bg-[#154212] text-white hover:bg-[#0d3308]'
                            : 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
                        )}
                      >
                        แลกเลย
                      </button>
                      {/* Add-to-cart button hidden for now — cart functionality disabled */}
                      {/* <motion.button
                        ref={(el) => {
                          if (el) buttonRefs.current[reward.id] = el
                        }}
                        onClick={() => handleCartClick(reward)}
                        disabled={!canRedeem}
                        animate={isClicked ? { scale: 0.85 } : { scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          'flex-[3] py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center',
                          canRedeem
                            ? 'bg-white border border-[#154212] text-[#154212] hover:bg-[#f5f5f5]'
                            : 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
                        )}
                      >
                        <div className="relative w-4 h-4">
                          <Image src="/icons/tabler-icon-add-cart.png" alt="ตะกร้า" fill className="object-contain" />
                        </div>
                      </motion.button> */}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Direct redeem modal (แลกเลย — single item, no cart) */}
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
                {/* Two action buttons side by side */}
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
