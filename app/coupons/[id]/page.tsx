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
      width: 240,
      margin: 2,
      color: { dark: '#154212', light: '#ffffff' },
    })
  }, [value])

  return (
    <canvas
      ref={canvasRef}
      className="rounded-xl"
      style={{ width: 240, height: 240 }}
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
    // Skeleton while hydrating
    return (
      <div className="min-h-screen bg-white">
        <PageHeader />
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="h-8 w-32 bg-[#f0f0f0] rounded-lg animate-pulse mb-6" />
          <div className="rounded-3xl bg-[#f0f0f0] h-96 animate-pulse" />
        </div>
      </div>
    )
  }

  if (!coupon) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader />
        <main className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-5">
            <Link href="/coupons" className="p-1 rounded-full hover:bg-[#f5f5f5] transition-colors">
              <ChevronLeft size={22} className="text-[#154212]" strokeWidth={2.5} />
            </Link>
            <h1 className="text-lg font-bold text-[#154212]">คูปองของฉัน</h1>
          </div>
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertCircle size={40} className="text-[#cc0000]" />
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
    <div className="min-h-screen bg-[#f5f7f5] pb-10">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Back + title */}
        <div className="flex items-center gap-2 mb-5">
          <Link href="/coupons" className="p-1 rounded-full hover:bg-[#f5f5f5] transition-colors">
            <ChevronLeft size={22} className="text-[#154212]" strokeWidth={2.5} />
          </Link>
          <h1 className="text-lg font-bold text-[#154212]">คูปองของฉัน</h1>
        </div>

        {/* Main coupon card — styled like the design reference */}
        <div
          className={cn(
            'rounded-3xl overflow-hidden shadow-lg',
            isUsed ? 'opacity-70' : ''
          )}
        >
          {/* Green header section */}
          <div className="bg-[#154212] px-6 pt-6 pb-10 flex flex-col items-center relative">
            {/* Decorative dots */}
            <div className="flex gap-1.5 mb-4 self-start">
              <div className="w-2 h-2 rounded-full bg-white/30" />
              <div className="w-2 h-2 rounded-full bg-white/30" />
            </div>

            {/* Mascot / leaf decoration */}
            <div className="absolute top-4 right-6 opacity-20">
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                <ellipse cx="30" cy="30" rx="20" ry="28" fill="white" transform="rotate(-20 30 30)" />
                <line x1="30" y1="10" x2="30" y2="50" stroke="#154212" strokeWidth="1.5" />
                <line x1="30" y1="25" x2="18" y2="18" stroke="#154212" strokeWidth="1" />
                <line x1="30" y1="30" x2="42" y2="23" stroke="#154212" strokeWidth="1" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-white mb-1">คูปองแลกรางวัล</h2>
            {isUsed && (
              <span className="text-xs font-semibold text-red-300 mb-1">ใช้งานแล้ว</span>
            )}

            {/* QR Code on white card */}
            <div className="bg-white rounded-2xl p-5 mt-4 shadow-inner flex items-center justify-center">
              <QRCanvas value={coupon.coupon_id} />
            </div>

            {/* Coupon ID label */}
            <p className="text-white/60 text-[10px] mt-3 tracking-widest font-mono">
              {coupon.coupon_id}
            </p>
          </div>

          {/* Ticket tear-line */}
          <div className="relative bg-white h-0">
            <div
              className="absolute left-0 right-0 flex"
              style={{ top: -1 }}
            >
              {Array.from({ length: 28 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-0.5 border-t-2 border-dashed border-[#e0e0e0]"
                />
              ))}
            </div>
            {/* Notch circles on sides */}
            <div className="absolute -left-4 -top-4 w-8 h-8 rounded-full bg-[#f5f7f5]" />
            <div className="absolute -right-4 -top-4 w-8 h-8 rounded-full bg-[#f5f7f5]" />
          </div>

          {/* White lower section — product detail */}
          <div className="bg-white px-6 pt-6 pb-6">
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">
              รายละเอียด
            </p>
            <div className="flex items-center gap-4">
              {/* Product image */}
              <div className="w-16 h-16 relative rounded-xl overflow-hidden bg-[#f5f5f5] flex-shrink-0 border border-[#e5e5e5]">
                <Image
                  src={coupon.reward_image}
                  alt={coupon.reward_name}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Product info */}
              <div className="flex-1 min-w-0">
                <span className="inline-block px-3 py-1 bg-[#154212] text-white text-sm font-bold rounded-lg mb-1">
                  {coupon.reward_name}
                </span>
                <p className="text-sm text-[#555555]">{coupon.reward_description}</p>
                <p className="text-xs text-[#aaaaaa] mt-1">แลกเมื่อ {dateStr}</p>
              </div>
            </div>

            {/* Points info */}
            <div className="mt-4 pt-4 border-t border-[#f0f0f0] flex justify-between items-center">
              <span className="text-xs text-[#888888]">คะแนนที่ใช้แลก</span>
              <span className="text-sm font-bold text-[#154212]">
                {coupon.points_used.toLocaleString()} คะแนน
              </span>
            </div>
          </div>
        </div>

        {/* Instruction note */}
        <p className="text-center text-xs text-[#888888] mt-5 leading-relaxed">
          แสดง QR code นี้ให้เจ้าหน้าที่สแกน{'\n'}เพื่อรับสินค้าของคุณ
        </p>
      </main>
    </div>
  )
}
