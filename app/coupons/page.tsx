'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, Ticket } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { useCoupons, type Coupon } from '@/lib/coupon-context'
import { cn } from '@/lib/utils'

function CouponCard({ coupon }: { coupon: Coupon }) {
  const isUsed = coupon.status === 'used'

  return (
    <Link href={`/coupons/${coupon.coupon_id}`} className="block">
      {/* Outer wrapper: provides space on left/right for the notch circles */}
      <div className={cn('relative mx-3', isUsed && 'opacity-60')}>
        {/* Left-edge ticket notch (white circle, page bg bleeds through) */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[55%] w-[26px] h-[26px] bg-white rounded-full z-20 shadow-inner" />

        {/* Card */}
        <div className="flex h-[126px] rounded-2xl overflow-hidden">
          {/* ── LEFT: dark green section ── */}
          <div className="relative w-[38%] flex-shrink-0 bg-[#154212] flex flex-col overflow-hidden">
            {/* Label */}
            <span className="text-white text-[10px] font-semibold leading-snug p-2.5 z-10 relative">
              คูปองแลกรางวัล
            </span>

            {/* Mascot — anchored to bottom-left, slightly overflowing upward */}
            <div className="absolute -bottom-1 left-0 w-full h-[105px]">
              <Image
                src="/mascot.png"
                alt="mascot"
                fill
                className="object-contain object-bottom"
              />
            </div>
          </div>

          {/* ── RIGHT: sage/content section ── */}
          <div className="flex-1 bg-[#ccdece] flex items-center px-3 gap-2 relative">
            {/* Divider notch circle (sits on the seam between left and right panels) */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-[26px] h-[26px] bg-white rounded-full z-10" />

            {/* Center: name badge + description */}
            <div className="flex-1 flex flex-col gap-1.5 pl-1">
              <div className="bg-[#154212] rounded-lg px-3 py-1 self-start">
                <span className="text-white text-[14px] font-semibold leading-tight">
                  {coupon.reward_name}
                </span>
              </div>
              <span className="text-[#154212] text-xs font-medium pl-0.5">
                {coupon.reward_description}
              </span>
              {isUsed && (
                <span className="text-[10px] font-semibold text-[#cc4444]">ใช้งานแล้ว</span>
              )}
            </div>

            {/* Product image */}
            <div className="relative w-[90px] h-[90px] flex-shrink-0">
              <Image
                src={coupon.reward_image}
                alt={coupon.reward_name}
                fill
                className="object-contain drop-shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Right-edge ticket notch */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[55%] w-[26px] h-[26px] bg-white rounded-full z-20 shadow-inner" />
      </div>
    </Link>
  )
}

export default function CouponsPage() {
  const { coupons, loading } = useCoupons()

  const activeCoupons = coupons.filter((c) => c.status === 'active')
  const usedCoupons = coupons.filter((c) => c.status === 'used')

  return (
    <div className="min-h-screen bg-white pb-10">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Back + title */}
        <div className="flex items-center gap-2 mb-5">
          <Link href="/rewards" className="p-1 rounded-full hover:bg-[#f5f5f5] transition-colors">
            <ChevronLeft size={22} className="text-[#154212]" strokeWidth={2.5} />
          </Link>
          <h1 className="text-lg font-bold text-[#154212]">คูปองของฉัน</h1>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="mx-3 h-[126px] rounded-2xl bg-[#f0f0f0] animate-pulse" />
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#e8f5e2] flex items-center justify-center">
              <Ticket size={32} className="text-[#154212]" />
            </div>
            <p className="text-base font-semibold text-[#154212]">ยังไม่มีคูปอง</p>
            <p className="text-sm text-[#666666]">แลกของรางวัลเพื่อรับคูปองสินค้า</p>
            <Link
              href="/rewards"
              className="mt-2 px-6 py-2.5 bg-[#154212] text-white text-sm font-bold rounded-xl hover:bg-[#0d3308] transition-colors"
            >
              ดูของรางวัล
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active coupons */}
            {activeCoupons.length > 0 && (
              <section>
                <div className="flex justify-center mb-4">
                  <div className="bg-[#e8f0e8] rounded-full px-5 py-1.5">
                    <span className="text-[#154212] text-xs font-semibold">
                      คูปองที่ใช้ได้ ({activeCoupons.length})
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  {activeCoupons.map((c) => (
                    <CouponCard key={c.coupon_id} coupon={c} />
                  ))}
                </div>
              </section>
            )}

            {/* Used / history */}
            {usedCoupons.length > 0 && (
              <section>
                <div className="flex justify-center mb-4">
                  <div className="bg-[#f0f0f0] rounded-full px-5 py-1.5">
                    <span className="text-[#888888] text-xs font-semibold">
                      ประวัติการใช้คูปอง ({usedCoupons.length})
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  {usedCoupons.map((c) => (
                    <CouponCard key={c.coupon_id} coupon={c} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
