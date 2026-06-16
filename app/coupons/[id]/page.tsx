'use client'

import { use, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { useCoupons } from '@/lib/coupon-context'
import { StyledQRCode } from '@/components/styled-qr-code'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

export default function CouponDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { getCoupon } = useCoupons()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const coupon = mounted ? getCoupon(id) : undefined
  const isUsed = coupon?.status === 'used'

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#f5f7f5]">
        <PageHeader />
        <div className="max-w-sm mx-auto px-4 py-4">
          <div className="h-8 w-32 bg-[#e0e0e0] rounded-lg animate-pulse mb-6" />
          <div className="rounded-3xl bg-[#e0e0e0] h-[500px] animate-pulse" />
        </div>
      </div>
    )
  }

  if (!coupon) {
    return (
      <div className="min-h-screen bg-[#f5f7f5]">
        <PageHeader />
        <main className="max-w-sm mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-5">
            <Link href="/coupons" className="p-1 rounded-full hover:bg-[#e8f0e8] transition-colors">
              <ChevronLeft size={22} className="text-[#154212]" strokeWidth={2.5} />
            </Link>
            <h1 className="text-lg font-bold text-[#154212]">คูปองของฉัน</h1>
          </div>
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertCircle size={40} className="text-red-500" />
            <p className="font-semibold text-[#154212]">ไม่พบคูปองนี้</p>
            <Link href="/coupons" className="text-sm text-[#157b03] underline">
              กลับไปรายการคูปอง
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const dateStr = format(new Date(coupon.redeemed_at), 'd MMMM yyyy', { locale: th })

  return (
    <div className="min-h-screen bg-[#f5f7f5] pb-12">
      <PageHeader />

      <main className="max-w-sm mx-auto px-4 py-4">
        {/* Back nav */}
        <div className="flex items-center gap-2 mb-5">
          <Link href="/coupons" className="p-1 rounded-full hover:bg-[#e8f0e8] transition-colors">
            <ChevronLeft size={22} className="text-[#154212]" strokeWidth={2.5} />
          </Link>
          <h1 className="text-lg font-bold text-[#154212]">คูปองของฉัน</h1>
        </div>

        {/* Coupon card — outer wrapper gives room for the side notches */}
        <div className={cn('relative mx-3', isUsed && 'opacity-60')}>

          {/* ── Top ticket notch (left & right on the top seam) ── */}
          <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none" style={{ top: 'calc(55% - 14px)' }}>
            <div className="absolute -left-[14px] top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#f5f7f5]" />
            <div className="absolute -right-[14px] top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#f5f7f5]" />
          </div>

          <div className="rounded-3xl overflow-hidden shadow-xl">

            {/* ── Top: dark green section ── */}
            <div className="bg-[#154212] relative flex flex-col items-center pb-8 overflow-hidden">

              {/* Mascot — flipped upside-down, large, peeking from top */}
              <div className="relative w-full flex justify-center" style={{ height: 120 }}>
                <Image
                  src="/mascot.png"
                  alt="mascot"
                  width={160}
                  height={160}
                  className="absolute -top-4 object-contain drop-shadow-lg"
                  style={{ transform: 'scaleY(-1)' }}
                />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-white mb-1 relative z-10">คูปองแลกรางวัล</h2>
              {isUsed && (
                <span className="text-xs font-semibold text-red-300 mb-1 relative z-10">ใช้งานแล้ว</span>
              )}

              {/* QR Code white card */}
              <div className="bg-white rounded-3xl p-4 mt-5 mx-6 shadow-md flex items-center justify-center relative z-10">
                <StyledQRCode value={coupon.coupon_id} size={260} />
              </div>
            </div>

            {/* ── Ticket seam between green and sage ── */}
            <div className="relative bg-[#ccdece] h-6 flex items-center">
              {/* Left notch on seam */}
              <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#f5f7f5]" />
              {/* Right notch on seam */}
              <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#f5f7f5]" />
              {/* Dashed divider */}
              <div className="w-full border-t-2 border-dashed border-white/70 mx-8" />
            </div>

            {/* ── Bottom: sage section ── */}
            <div className="bg-[#ccdece] px-5 pt-4 pb-6">
              <p className="text-sm font-semibold text-[#4a7a4a] mb-3">รายละเอียด</p>

              <div className="bg-white/40 rounded-2xl p-3 flex items-center gap-4">
                {/* Product image */}
                <div className="w-20 h-20 relative rounded-xl overflow-hidden bg-white flex-shrink-0 border border-white/60 shadow-sm">
                  <Image
                    src={coupon.reward_image}
                    alt={coupon.reward_name}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <span className="inline-block px-4 py-1.5 bg-[#154212] text-white text-sm font-bold rounded-xl mb-2">
                    {coupon.reward_name}
                  </span>
                  <p className="text-sm text-[#3a5c3a] font-medium">{coupon.reward_description}</p>
                  <p className="text-xs text-[#5a7a5a] mt-1">แลกเมื่อ {dateStr}</p>
                </div>
              </div>

              {/* Points used */}
              <div className="mt-3 flex justify-between items-center px-1">
                <span className="text-xs text-[#5a7a5a]">คะแนนที่ใช้แลก</span>
                <span className="text-sm font-bold text-[#154212]">
                  {coupon.points_used.toLocaleString()} คะแนน
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Instruction note */}
        <p className="text-center text-xs text-[#888888] mt-6 leading-relaxed">
          แสดง QR code นี้ให้เจ้าหน้าที่สแกน เพื่อรับสินค้าของคุณ
        </p>
      </main>
    </div>
  )
}
