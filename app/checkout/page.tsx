'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { BottomNav } from '@/components/bottom-nav'
import { REWARDS } from '@/lib/waste-data'

interface CheckoutItem {
  id: number
  quantity: number
}

export default function CheckoutPage() {
  const userPoints = 2048
  const [checkoutItems] = useState<CheckoutItem[]>([
    { id: 1, quantity: 1 },
    { id: 2, quantity: 8 },
  ])

  const totalPointsNeeded = checkoutItems.reduce((sum, item) => {
    const reward = REWARDS.find(r => r.id === item.id)
    return sum + (reward?.points || 0) * item.quantity
  }, 0)

  const remainingPoints = userPoints - totalPointsNeeded

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
          {checkoutItems.map((item) => {
            const reward = REWARDS.find(r => r.id === item.id)
            if (!reward) return null

            const itemTotal = reward.points * item.quantity

            return (
              <div key={reward.id} className="grid grid-cols-12 gap-2 items-center text-xs px-2">
                <div className="col-span-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 relative bg-[#f5f5f5] rounded">
                      <Image
                        src={reward.image}
                        alt={reward.name}
                        fill
                        className="object-cover rounded"
                      />
                    </div>
                    <p className="font-medium text-[#444444] line-clamp-1">
                      {reward.name}
                    </p>
                  </div>
                </div>
                <div className="col-span-2 text-center text-[#444444] font-medium">
                  {reward.points}
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
            <span className="font-semibold text-[#444444]">{userPoints}</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-[#666666]">รวมที่สั่ง</span>
            <span className="font-semibold text-[#444444]">{totalPointsNeeded} คะแนน</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-[#666666]">คงเหลือ</span>
            <span className="font-semibold text-[#444444]">{remainingPoints} คะแนน</span>
          </div>
        </div>

        {/* Confirm Button */}
        <button className="w-full bg-[#154212] text-white py-3 rounded-lg font-semibold hover:bg-[#0d3308] transition-colors">
          ยืนยัน
        </button>
      </main>

      <BottomNav />
    </div>
  )
}
