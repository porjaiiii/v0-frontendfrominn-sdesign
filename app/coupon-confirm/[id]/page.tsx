'use client'

import { use, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useLiffContext } from '@/lib/liff-context'
import type { Coupon } from '@/lib/coupon-context'
import { useAdmin } from '@/lib/admin-context'

type Status = 'loading' | 'ready' | 'confirming' | 'success' | 'error' | 'already_used' | 'not_found'

export default function CouponConfirmPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  // id อาจเป็น coupon_id โดยตรง หรือ full URL ที่ encode มา
  // ถ้ามี '/' อยู่ใน decoded value = full URL → ดึงเฉพาะ path segment สุดท้าย
  const rawId = decodeURIComponent(id)
  const couponId = rawId.startsWith('http')
    ? rawId.split('/').pop() ?? rawId
    : rawId
  const router = useRouter()
  const { profile } = useLiffContext()
  const { isAdmin, adminLogout } = useAdmin()

  const [coupon, setCoupon] = useState<Coupon | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState<string>('')
  console.log('1. isAdmin:', isAdmin)

  // Fetch coupon info when page loads
  useEffect(() => {
    if (!isAdmin) return
    const fetchCoupon = async () => {
      setStatus('loading')
      try {
        const res = await fetch(`/api/coupons/${encodeURIComponent(couponId)}`)
        if (res.status === 404) {
          setStatus('not_found')
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (data.success && data.coupon) {
          const c: Coupon = data.coupon
          if (c.status === 'used') {
            setCoupon(c)
            setStatus('already_used')
          } else if (c.status === 'expired') {
            setCoupon(c)
            setStatus('error')
            setErrorMsg('คูปองนี้หมดอายุแล้ว')
          } else {
            setCoupon(c)
            setStatus('ready')
          }
        } else {
          setStatus('not_found')
        }
      } catch (err) {
        setStatus('error')
        setErrorMsg('ไม่สามารถโหลดข้อมูลคูปองได้')
      }
    }

    fetchCoupon()
  }, [couponId])

  const handleConfirm = async () => {
    if (!coupon) return
    setStatus('confirming')
    try {
      const res = await fetch('/api/coupons/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupon_id: couponId ,
          scanned_by: profile?.userId ?? '',
        }),
      })

        if (res.status === 409) {
          setStatus('already_used')
          return
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error ?? 'ไม่สามารถอัปเดตคูปองได้')
        }

        setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    }
  }

  const handleCancel = () => {
    router.back()
  }

  const handleScanAgain = () => {
    router.back()
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#f5f7f5]">
        <PageHeader />
        <div className="max-w-sm mx-auto px-4 py-4">
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={40} className="text-[#154212] animate-spin" />
            <p className="text-sm text-[#666666]">กำลังโหลดข้อมูลคูปอง...</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Not found state ────────────────────────────────────────────────────────
  if (status === 'not_found') {
    return (
      <div className="min-h-screen bg-[#f5f7f5]">
        <PageHeader />
        <main className="max-w-sm mx-auto px-4 py-4">
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <XCircle size={52} className="text-[#e53935]" />
            <h2 className="text-base font-bold text-[#154212]">ไม่พบคูปองนี้</h2>
            <p className="text-sm text-[#666666]">QR Code ไม่ถูกต้องหรือคูปองไม่มีในระบบ</p>
            <Button
              onClick={handleScanAgain}
              className="mt-2 bg-[#154212] hover:bg-[#0d3308] text-white rounded-xl px-8"
            >
              สแกนใหม่
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // ── Already used state ─────────────────────────────────────────────────────
  if (status === 'already_used') {
    return (
      <div className="min-h-screen bg-[#f5f7f5]">
        <PageHeader />
        <main className="max-w-sm mx-auto px-4 py-4">
          <h1 className="text-lg font-bold text-[#154212] mb-5 text-center">ยืนยันการใช้คูปอง</h1>

          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
            {coupon && (
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-[#e0e0e0]">
                  <Image src={coupon.reward_image} alt={coupon.reward_name} fill className="object-cover" />
                </div>
                <div>
                  <p className="font-semibold text-[#154212] text-sm">{coupon.reward_name}</p>
                  <p className="text-xs text-[#666666] mt-0.5">{coupon.reward_description}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-3 py-6">
            <XCircle size={52} className="text-[#e53935]" />
            <p className="font-bold text-[#c62828] text-base">คูปองนี้ถูกใช้งานแล้ว</p>
            <p className="text-sm text-[#666666] text-center">ไม่สามารถใช้คูปองซ้ำได้</p>
            <Button
              onClick={handleScanAgain}
              className="mt-2 bg-[#154212] hover:bg-[#0d3308] text-white rounded-xl px-8"
            >
              สแกนใหม่
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#f5f7f5]">
        <PageHeader />
        <main className="max-w-sm mx-auto px-4 py-4">
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <AlertCircle size={52} className="text-[#e53935]" />
            <h2 className="text-base font-bold text-[#154212]">เกิดข้อผิดพลาด</h2>
            <p className="text-sm text-[#666666]">{errorMsg}</p>
            <Button
              onClick={handleScanAgain}
              className="mt-2 bg-[#154212] hover:bg-[#0d3308] text-white rounded-xl px-8"
            >
              สแกนใหม่
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#f5f7f5]">
        <PageHeader />
        <main className="max-w-sm mx-auto px-4 py-4">
          <h1 className="text-lg font-bold text-[#154212] mb-5 text-center">ยืนยันการใช้คูปอง</h1>

          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
            {coupon && (
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-[#e0e0e0]">
                  <Image src={coupon.reward_image} alt={coupon.reward_name} fill className="object-cover" />
                </div>
                <div>
                  <p className="font-semibold text-[#154212] text-sm">{coupon.reward_name}</p>
                  <p className="text-xs text-[#666666] mt-0.5">{coupon.reward_description}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 size={52} className="text-[#2e7d32]" />
            <p className="font-bold text-[#2e7d32] text-base">ยืนยันสำเร็จ!</p>
            <p className="text-sm text-[#666666] text-center">คูปองถูกใช้งานแล้วเรียบร้อย</p>
            <Button
              onClick={handleScanAgain}
              className="mt-2 bg-[#154212] hover:bg-[#0d3308] text-white rounded-xl px-8"
            >
              สแกนคูปองถัดไป
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // ── Ready / Confirming state (main confirm UI) ─────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f7f5]">
      <PageHeader />

      <main className="max-w-sm mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-[#154212] mb-6">ยืนยันการใช้คูปอง</h1>

        {/* Coupon preview card */}
        {coupon && (
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="relative w-[72px] h-[72px] rounded-xl overflow-hidden flex-shrink-0 border border-[#e0e0e0] bg-[#f5f7f5]">
                <Image
                  src={coupon.reward_image}
                  alt={coupon.reward_name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#154212] text-sm leading-snug">{coupon.reward_name}</p>
                <p className="text-xs text-[#666666] mt-1">{coupon.reward_description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={status === 'confirming'}
            className="flex-1 h-12 rounded-xl border-[#154212] text-[#154212] font-semibold text-base hover:bg-[#e8f0e8]"
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={status === 'confirming'}
            className="flex-1 h-12 rounded-xl bg-[#154212] hover:bg-[#0d3308] text-white font-semibold text-base"
          >
            {status === 'confirming' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                กำลังยืนยัน...
              </>
            ) : (
              'ยืนยัน'
            )}
          </Button>
        </div>
      </main>
    </div>
  )
}
