'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, Ticket } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { useCoupons, type Coupon } from '@/lib/coupon-context'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

function CouponCard({ coupon, index }: { coupon: Coupon; index: number }) {
  const isEven = index % 2 === 0
  const isUsed = coupon.status === 'used'
  const dateStr = format(new Date(coupon.redeemed_at), 'd MMM yyyy', { locale: th })

  return (
    <Link
      href={`/coupons/${coupon.coupon_id}`}
      className={cn(
        'flex items-stretch rounded-2xl overflow-hidden border transition-shadow hover:shadow-md',
        isUsed ? 'opacity-60 border-[#d0d0d0]' : 'border-[#c8dfc8]'
      )}
    >
      {/* Left green label — only on even cards; right on odd (alternating layout) */}
      {isEven && (
        <div className="w-20 bg-[#154212] flex flex-col items-center justify-center gap-1 flex-shrink-0 p-2">
          <div className="w-8 h-8 relative">
            {/* Mascot leaf icon */}
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Ticket size={18} className="text-white" />
            </div>
          </div>
          <span className="text-[9px] font-semibold text-white text-center leading-tight">
            คูปอง{'\n'}แลกรางวัล
          </span>
        </div>
      )}

      {/* Center content */}
      <div className="flex-1 bg-[#f0f7ee] px-4 py-3 flex flex-col justify-center min-w-0">
        <p className="text-sm font-bold text-[#154212] truncate">{coupon.reward_name}</p>
        <p className="text-xs text-[#555555]">{coupon.reward_description}</p>
        <p className="text-[10px] text-[#888888] mt-1">{dateStr}</p>
        {isUsed && (
          <span className="text-[10px] font-semibold text-[#cc0000] mt-0.5">ใช้งานแล้ว</span>
        )}
      </div>

      {/* Product image */}
      <div className="w-24 h-24 relative flex-shrink-0 bg-[#e8f5e2]">
        <Image
          src={coupon.reward_image}
          alt={coupon.reward_name}
          fill
          className="object-cover"
        />
      </div>

      {/* Right green label — on odd cards */}
      {!isEven && (
        <div className="w-20 bg-[#154212] flex flex-col items-center justify-center gap-1 flex-shrink-0 p-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Ticket size={18} className="text-white" />
          </div>
          <span className="text-[9px] font-semibold text-white text-center leading-tight">
            คูปอง{'\n'}แลกรางวัล
          </span>
        </div>
      )}
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
        {/* Back + title row */}
        <div className="flex items-center gap-2 mb-5">
          <Link href="/rewards" className="p-1 rounded-full hover:bg-[#f5f5f5] transition-colors">
            <ChevronLeft size={22} className="text-[#154212]" strokeWidth={2.5} />
          </Link>
          <h1 className="text-lg font-bold text-[#154212]">คูปองของฉัน</h1>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-[#f0f0f0] animate-pulse" />
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
                <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">
                  คูปองที่ใช้ได้ ({activeCoupons.length})
                </p>
                <div className="flex flex-col gap-3">
                  {activeCoupons.map((c, i) => (
                    <CouponCard key={c.coupon_id} coupon={c} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Used coupons history */}
            {usedCoupons.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">
                  ประวัติการใช้คูปอง ({usedCoupons.length})
                </p>
                <div className="flex flex-col gap-3">
                  {usedCoupons.map((c, i) => (
                    <CouponCard key={c.coupon_id} coupon={c} index={i} />
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
