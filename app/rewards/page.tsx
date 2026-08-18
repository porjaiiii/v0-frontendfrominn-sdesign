'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, CheckCircle2, Ticket, ArrowUpDown, Store, Truck, ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { REWARDS } from '@/lib/waste-data'
import { useCart } from '@/lib/cart-context'
import { cn } from '@/lib/utils'
import { usePoints } from '@/lib/points-context'
import { useCoupons } from '@/lib/coupon-context'

const CASH_REWARD = {
  id: 99,
  name: 'แลกแต้มเป็นเงินคืน',
  description: 'คูปองแลกเงินสด',
  points: 20,
  image: '/images/rewards/THB-cash.jpg',
  isCash: true,
} as const

export default function RewardsPage() {
  const { points: userPoints, loading: pointsLoading, spendPoints } = usePoints()
  const { addToCart, cartCount } = useCart()
  const { addCoupon } = useCoupons()
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [mounted, setMounted] = useState(false)
  const [clickedButton, setClickedButton] = useState<number | null>(null)
  const buttonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({})
  const [showBadge, setShowBadge] = useState(false)

  // Sort State: default 'asc' (น้อยไปมาก)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Sorted REWARDS based on sortOrder
  const sortedRewards = useMemo(() => {
    return [...REWARDS].sort((a, b) => {
      return sortOrder === 'asc' ? a.points - b.points : b.points - a.points
    })
  }, [sortOrder])

  // Direct "แลกเลย" redeem (single item, no cart)
  const [redeemTarget, setRedeemTarget] = useState<typeof REWARDS[number] | null>(null)
  // State สำหรับขั้นตอนใน Modal: 1 = เลือกช่องทางรับ, 2 = ยืนยันการแลก
  const [redeemStep, setRedeemStep] = useState<1 | 2>(1)
  // State สำหรับเลือกรูปแบบการรับของรางวัล: 'pickup' (เดินทางไปรับเอง) หรือ 'delivery' (รอรับที่บ้าน)
  const [redeemType, setRedeemType] = useState<'pickup' | 'delivery'>('pickup')
  const [processing, setProcessing] = useState(false)
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [redeemSuccess, setRedeemSuccess] = useState(false)
  const [newCouponId, setNewCouponId] = useState<string | null>(null)
  const [cashPoints, setCashPoints] = useState('20')

  const redeemInFlight = useRef(false)
  const isCashRedeem = redeemTarget?.id === CASH_REWARD.id
  const cashAmount = Number.parseInt(cashPoints, 10)
  const cashAmountValid = Number.isInteger(cashAmount) && cashAmount >= 20 && cashAmount <= userPoints

  const openRedeem = (reward: typeof REWARDS[number]) => {
    setRedeemTarget(reward)
    setRedeemStep(1) // รีเซ็ตกลับไปขั้นตอนที่ 1 เสมอ
    setRedeemType('pickup') // รีเซ็ตกลับเป็น 'รับเอง' เป็นค่าเริ่มต้น
    setRedeemError(null)
    setRedeemSuccess(false)
    setNewCouponId(null)
    setCashPoints('20')
  }

  const handleConfirmRedeem = async () => {
    if (!redeemTarget) return
    if (redeemInFlight.current) return
    setRedeemError(null)

    console.log('[v0] handleConfirmRedeem — redeemTarget:', redeemTarget)
    console.log('[v0] handleConfirmRedeem — userPoints:', userPoints)
    console.log('[v0] handleConfirmRedeem — redeemType:', redeemType)

    const pointsToSpend = isCashRedeem ? cashAmount : redeemTarget.points
    if (isCashRedeem && !cashAmountValid) {
      setRedeemError(cashAmount > userPoints ? 'คะแนนของคุณไม่เพียงพอ' : 'กรุณากรอกจำนวนเต็มอย่างน้อย 20 แต้ม')
      return
    }

    if (pointsToSpend > userPoints) {
      console.log('[v0] handleConfirmRedeem — not enough points, required:', redeemTarget.points, 'have:', userPoints)
      setRedeemError('คะแนนของคุณไม่เพียงพอ')
      return
    }

    redeemInFlight.current = true
    setProcessing(true)

    try {
      const result = await spendPoints(pointsToSpend, {
        category: 'reward',
        items: [{ name: redeemTarget.name, quantity: 1, points: pointsToSpend }],
      })

      console.log('[v0] spendPoints — result:', result)

      if (result.success) {
        console.log('[v0] spendPoints — success, tx_id:', result.tx_id)
        try {
          const payload = {
            reward_id: redeemTarget.id,
            reward_name: redeemTarget.name,
            reward_description: `${redeemTarget.description ?? ''}${isCashRedeem ? ` ${cashAmount.toLocaleString()} บาท` : ''}`,
            reward_image: redeemTarget.image,
            points_used: pointsToSpend,
            tx_id: result.tx_id,
            redeem_type: isCashRedeem ? 'pickup' : redeemType, // เงินคืนรับคูปองไปดำเนินการกับเจ้าหน้าที่
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
          <div className="absolute top-4 right-4 flex gap-2">
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

        {/* Rewards Section Header & Sort Control */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#154212]">รางวัลที่สามารถแลกได้</h2>
            <div className="relative flex items-center gap-1 bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg px-2.5 py-1 text-xs text-[#444444]">
              <ArrowUpDown size={13} className="text-[#666666]" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="bg-transparent font-medium text-[#444444] outline-none cursor-pointer pr-1"
              >
                <option value="asc">แต้ม: น้อยไปมาก</option>
                <option value="desc">แต้ม: มากไปน้อย</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-red-600 leading-relaxed">* หมายเหตุ รูปใช้เพื่อการโฆษณาเท่านั้น แบรนด์ของสินค้าสามารถปรับเปลี่ยนได้ตามความเหมาะสม</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-[#c3e2be] overflow-hidden relative flex flex-col">
              <div className="aspect-square relative bg-[#f0f7ef]">
                <Image src={CASH_REWARD.image} alt="แลกเงินคืน" fill className="object-cover opacity-80" />
                <div className="absolute inset-0 flex items-center justify-center bg-[#154212]/10">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-[#154212]">เงินคืน</span>
                </div>
              </div>
              <div className="p-3 flex flex-col flex-1">
                <h3 className="text-sm font-medium text-[#444444] mb-1">แลกเงินคืน</h3>
                <p className="text-xs text-[#666666] mb-2 line-clamp-2">กรอกแต้มที่ต้องการแลก ขั้นต่ำ 20 แต้ม</p>
                <div className="flex items-center justify-between mb-3 mt-auto">
                  <span className={cn('text-sm font-semibold', userPoints >= 20 ? 'text-[#157b03]' : 'text-[#999999]')}>เริ่มต้น 20 แต้ม</span>
                </div>
                <button
                  onClick={() => openRedeem(CASH_REWARD)}
                  disabled={userPoints < 20}
                  className={cn('w-full py-2 rounded-lg text-sm font-medium transition-colors', userPoints >= 20 ? 'bg-[#154212] text-white hover:bg-[#0d3308]' : 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed')}
                >
                  แลกเงินคืน
                </button>
              </div>
            </div>
            {sortedRewards.map((reward) => {
              const canRedeem = userPoints >= reward.points
              const isFavorited = favorites.has(reward.id)

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

                  <div className="aspect-square relative bg-[#f5f5f5]">
                    <Image
                      src={reward.image}
                      alt={reward.name}
                      fill
                      className="object-cover"
                    />
                  </div>

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
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Direct redeem modal */}
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
                  {redeemTarget.name} · ใช้ไป {isCashRedeem ? cashAmount.toLocaleString() : redeemTarget.points.toLocaleString()} คะแนน{isCashRedeem ? ` รับคูปองเงินคืน ${cashAmount.toLocaleString()} บาท` : ''}
                </p>
                <p className="text-xm font-medium text-[#d43a34] bg-[#e8f5e2] px-3 py-1 rounded-full mb-2">
                  รับคูปองเรียบร้อย หากเจ้าหน้าที่ให้แสดงคูปองเพื่อรับของรางวัล คลิก “คูปองของฉัน” เพื่อแสดงคูปองที่ท่านมีอยู่ จากนั้น
คลิกที่รางวัลที่จะแลกเพื่อให้เจ้าหน้าที่ดำเนินการ
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
            ) : redeemStep === 1 ?
              <>
  <div className="flex items-center gap-3 mb-4">
    <div className="w-14 h-14 relative bg-[#f5f5f5] rounded-lg overflow-hidden flex-shrink-0">
      <Image src={redeemTarget.image} alt={redeemTarget.name} fill className="object-cover" />
    </div>
    <div>
      <h2 className="text-lg font-bold text-[#154212]">{redeemTarget.name}</h2>
      <p className="text-sm text-[#157b03] font-semibold">{isCashRedeem ? `${cashAmount || 0} แต้ม = ${cashAmount || 0} บาท` : `${redeemTarget.points.toLocaleString()} คะแนน`}</p>
    </div>
  </div>

  {isCashRedeem && (
    <div className="mb-5 rounded-xl border border-[#c3e2be] bg-[#f0f7ef] p-4">
      <label htmlFor="cash-points" className="block text-sm font-bold text-[#154212] mb-2">ต้องการแลกกี่แต้ม?</label>
      <input id="cash-points" type="number" min={20} step={1} value={cashPoints} onChange={(e) => setCashPoints(e.target.value)} className="w-full rounded-lg border border-[#c3e2be] bg-white px-3 py-2 text-lg font-bold text-[#154212] outline-none focus:ring-2 focus:ring-[#157b03]" />
      <p className="mt-2 text-xs leading-relaxed text-[#666666]">ขั้นต่ำ 20 แต้ม และ 1 แต้มมีมูลค่าเท่ากับ 1 บาท</p>
      {cashPoints && !cashAmountValid && <p className="mt-1 text-xs text-[#cc0000]">กรุณากรอกจำนวนเต็มตั้งแต่ 20 แต้ม และไม่เกินคะแนนคงเหลือ</p>}
      {cashAmountValid && <p className="mt-2 text-sm font-semibold text-[#157b03]">จะได้รับคูปองเงินคืน {cashAmount.toLocaleString()} บาท</p>}
    </div>
  )}
  <div className="mb-5 space-y-3">
    <div>
      <h3 className="text-xs font-bold text-[#154212] mb-0.5">ช่องทางการแลกของรางวัล</h3>
      <p className="text-[11px] text-[#666666]">โปรดอ่านรายละเอียดการรับของรางวัลแต่ละช่องทางด้านล่าง</p>
    </div>

    <div className="bg-[#f0f7ef] border border-[#c3e2be] rounded-xl p-3.5 space-y-3 text-xs text-[#154212]">
      {/* รายละเอียด: เดินทางมารับเอง */}
      <div className="space-y-1">
        <p className="font-semibold flex items-center gap-1.5 text-xs text-[#154212]">
          <Store size={15} className="text-[#157b03] flex-shrink-0" />
          <span>เข้ามารับเองที่บริษัท เลิร์นดู</span>
        </p>
        <p className="text-[#444444] pl-5 text-[11px] leading-relaxed">
          สามารถเดินทางมารับของรางวัล ทุกวันอาทิตย์ 10.00-16.00 น.
        </p>
      </div>

      <hr className="border-[#c3e2be]/60" />

      {/* รายละเอียด: จัดส่งถึงบ้าน */}
      <div className="space-y-1">
        <p className="font-semibold flex items-center gap-1.5 text-xs text-[#154212]">
          <Truck size={15} className="text-[#157b03] flex-shrink-0" />
          <span>จัดส่งถึงบ้าน</span>
        </p>
        <p className="text-[#444444] pl-5 text-[11px] leading-relaxed">
          รอรับรางวัลได้ตามรอบการเข้ารับขยะของแต่ละตำบล
        </p>
      </div>
    </div>
  </div>

  <div className="flex gap-3">
    <button
      type="button"
      onClick={() => setRedeemTarget(null)}
      className="flex-1 py-3 border-2 border-[#e5e5e5] text-[#154212] font-bold rounded-lg hover:bg-[#f5f5f5] transition-colors text-sm"
    >
      ยกเลิก
    </button>
    <button
      type="button"
      onClick={() => setRedeemStep(2)}
      className="flex-1 py-3 bg-[#154212] text-white font-bold rounded-lg hover:bg-[#0d3308] transition-colors text-sm"
    >
      ถัดไป
    </button>
  </div>
</>
            : (
              /* ── STEP 2: หน้าต่างยืนยันการแลกคะแนน ── */
              <>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f0f0f0]">
                  <button
                    onClick={() => setRedeemStep(1)}
                    className="flex items-center gap-1 text-xs text-[#666666] hover:text-[#154212] font-medium"
                  >
                    <ChevronLeft size={16} />
                    ย้อนกลับ
                  </button>
               
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 relative bg-[#f5f5f5] rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={redeemTarget.image} alt={redeemTarget.name} fill className="object-cover" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#154212]">{redeemTarget.name}</h2>
                    <p className="text-sm text-[#157b03] font-semibold">{isCashRedeem ? `${cashAmount || 0} แต้ม = ${cashAmount || 0} บาท` : `${redeemTarget.points.toLocaleString()} คะแนน`}</p>
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
                    onClick={() => setRedeemStep(1)}
                    disabled={processing}
                    className="flex-1 py-3 border-2 border-[#e5e5e5] text-[#154212] font-bold rounded-lg hover:bg-[#f5f5f5] transition-colors disabled:opacity-50"
                  >
                    ย้อนกลับ
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
