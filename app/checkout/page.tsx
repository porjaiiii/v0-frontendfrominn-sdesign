'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, CheckCircle2 } from 'lucide-react'
import { useCart } from '@/lib/cart-context'
import { usePoints } from '@/lib/points-context'
import { cn } from '@/lib/utils'

export default function CheckoutPage() {
  const router = useRouter()
  const { items: cartItems, clearCart } = useCart()
  const { points: userPoints, loading: pointsLoading, spendPoints } = usePoints()

  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalPointsNeeded = cartItems.reduce(
    (sum, item) => sum + item.points * item.quantity,
    0
  )
  const remainingPoints = userPoints - totalPointsNeeded
  const notEnough = remainingPoints < 0

  const handleConfirm = async () => {
    setError(null)

    if (cartItems.length === 0) {
      setError('ตะกร้าว่างเปล่า')
      return
    }
    if (notEnough) {
      setError('คะแนนของคุณไม่เพียงพอ')
      return
    }

    setProcessing(true)
    const result = await spendPoints(totalPointsNeeded, {
      category: 'reward',
      items: cartItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        points: item.points * item.quantity,
      })),
    })
    setProcessing(false)

    if (result.success) {
      clearCart()
      setSuccess(true)
    } else {
      setError(result.message || 'ไม่สามารถชำระแต้มได้ กรุณาลองใหม่')
    }
  }

  // Success screen after points have been spent
  if (success) {
    return (
      <div className="min-h-screen bg-white pb-24 flex flex-col items-center justify-center px-4 text-center">
        <CheckCircle2 size={72} className="text-[#157b03] mb-4" />
        <h1 className="text-xl font-semibold text-[#154212] mb-2">แลกรางวัลสำเร็จ!</h1>
        <p className="text-sm text-[#666666] mb-6">
          ใช้ไป {totalPointsNeeded.toLocaleString()} คะแนน · คงเหลือ{' '}
          {Math.max(0, remainingPoints).toLocaleString()} คะแนน
        </p>
        <div className="flex gap-3">
          <Link
            href="/rewards"
            className="px-5 py-2.5 bg-[#154212] text-white rounded-lg text-sm font-medium hover:bg-[#0d3308] transition-colors"
          >
            กลับไปหน้ารางวัล
          </Link>
          <Link
            href="/history"
            className="px-5 py-2.5 border border-[#154212] text-[#154212] rounded-lg text-sm font-medium hover:bg-[#f5f5f5] transition-colors"
          >
            ดูประวัติ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-[#e5e5e5] z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/cart" className="hover:opacity-70 transition-opacity">
            <ChevronLeft size={24} className="text-[#154212]" />
          </Link>
          <h1 className="text-lg font-semibold text-[#154212]">ชำระแต้ม</h1>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 py-4">
        {cartItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">ตะกร้าว่างเปล่า</p>
            <Link
              href="/rewards"
              className="text-sm text-[#154212] underline"
            >
              เลือกของรางวัล
            </Link>
          </div>
        ) : (
          <>
            {/* Items Summary */}
            <div className="space-y-3 mb-6">
              {/* Table Headers */}
              <div className="grid grid-cols-12 gap-2 mb-3 px-2 text-xs text-[#666666] font-medium">
                <div className="col-span-4">ชื่อสินค้า</div>
                <div className="col-span-2 text-center">คะแนน</div>
                <div className="col-span-3 text-center">จำนวน</div>
                <div className="col-span-3 text-center">คะแนนรวม</div>
              </div>

              {/* Items */}
              {cartItems.map((item) => {
                const itemTotal = item.points * item.quantity
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 items-center text-xs px-2"
                  >
                    <div className="col-span-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 relative bg-[#f5f5f5] rounded">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-cover rounded"
                          />
                        </div>
                        <p className="font-medium text-[#444444] line-clamp-1">
                          {item.name}
                        </p>
                      </div>
                    </div>
                    <div className="col-span-2 text-center text-[#444444] font-medium">
                      {item.points}
                    </div>
                    <div className="col-span-3 text-center bg-gray-100 rounded py-1 text-[#444444] font-medium">
                      {item.quantity}
                    </div>
                    <div className="col-span-3 text-center text-[#444444] font-medium">
                      {itemTotal}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Divider */}
            <div className="border-t border-[#e5e5e5] my-4"></div>

            {/* Summary Section */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#666666]">แต้มปัจจุบัน</span>
                <span className="font-semibold text-[#444444]">
                  {pointsLoading ? '…' : userPoints.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-[#666666]">รวมที่สั่ง</span>
                <span className="font-semibold text-[#444444]">
                  {totalPointsNeeded.toLocaleString()} คะแนน
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-[#666666]">คงเหลือ</span>
                <span
                  className={cn(
                    'font-semibold',
                    notEnough ? 'text-red-500' : 'text-[#444444]'
                  )}
                >
                  {remainingPoints.toLocaleString()} คะแนน
                </span>
              </div>
            </div>

            {/* Error notice */}
            {error && (
              <div className="text-xs text-[#cc0000] bg-[#fff0f0] border border-[#ffb3b3] rounded-lg px-3 py-2 mb-3">
                {error}
              </div>
            )}

            {/* Confirm Button */}
            <button
              onClick={handleConfirm}
              disabled={processing || notEnough || pointsLoading}
              className={cn(
                'w-full py-3 rounded-lg font-semibold transition-colors',
                processing || notEnough || pointsLoading
                  ? 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
                  : 'bg-[#154212] text-white hover:bg-[#0d3308]'
              )}
            >
              {processing ? 'กำลังดำเนินการ…' : notEnough ? 'คะแนนไม่เพียงพอ' : 'ยืนยัน'}
            </button>
          </>
        )}
      </main>
    </div>
  )
}
