'use client'

import { use, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import QRCode from 'qrcode'
import { PageHeader } from '@/components/page-header'
import { useCoupons } from '@/lib/coupon-context'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

function QRCanvas({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: 260,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
  }, [value])

  return (
    <canvas
      ref={canvasRef}
      className="rounded-2xl"
      style={{ width: 260, height: 260 }}
    />
  )
}

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

        {/* Coupon card */}
        <div className={cn('rounded-3xl overflow-visible shadow-xl', isUsed && 'opacity-60')}>

          {/* ── Top: dark green section ── */}
          <div className="bg-[#1e5c0e] rounded-t-3xl relative pt-0 pb-8 flex flex-col items-center overflow-hidden">

            {/* Mascot peeking from top edge */}
            <div className="relative w-full flex justify-start pl-4" style={{ height: 72 }}>
              {/* dots on mascot face */}
              <div className="absolute top-4 left-6 flex gap-1.5 z-10">
                <div className="w-2 h-2 rounded-full bg-white/70" />
                <div className="w-2 h-2 rounded-full bg-white/70" />
              </div>
              {/* Mascot image */}
              <Image
                src="/mascot.png"
                alt="mascot"
                width={90}
                height={90}
                className="absolute -top-3 left-3 object-contain drop-shadow-lg z-10"
              />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-white mb-1 z-10">คูปองแลกรางวัล</h2>
            {isUsed && (
              <span className="text-xs font-semibold text-red-300 mb-1 z-10">ใช้งานแล้ว</span>
            )}

            {/* QR Code white card */}
            <div className="bg-white rounded-3xl p-4 mt-5 mx-6 shadow-md flex items-center justify-center z-10">
              <QRCanvas value={coupon.coupon_id} />
            </div>
          </div>

          {/* Ticket notch seam */}
          <div className="relative bg-[#ccdece] h-5 flex items-center">
            {/* Left notch */}
            <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#f5f7f5]" />
            {/* Right notch */}
            <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#f5f7f5]" />
            {/* Dashed line */}
            <div className="w-full border-t-2 border-dashed border-white/60 mx-6" />
          </div>

          {/* ── Bottom: sage section ── */}
          <div className="bg-[#ccdece] rounded-b-3xl px-5 pt-4 pb-6">
            <p className="text-sm font-semibold text-[#4a7a4a] mb-3">รายละเอียด</p>

            <div className="bg-[#dce8dc]/60 rounded-2xl p-3 flex items-center gap-4">
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

        {/* Instruction note */}
        <p className="text-center text-xs text-[#888888] mt-6 leading-relaxed">
          แสดง QR code นี้ให้เจ้าหน้าที่สแกน เพื่อรับสินค้าของคุณ
        </p>
      </main>
    </div>
  )
}
