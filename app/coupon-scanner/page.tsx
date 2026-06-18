'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, QrCode } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useLiffContext } from '@/lib/liff-context'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function CouponScannerPage() {
  const router = useRouter()
  const { scanCode, isInClient, isReady } = useLiffContext()

  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleScanQR = async () => {
    try {
      if (!isReady) {
        setError('LIFF ยังไม่พร้อม โปรดรอสักครู่...')
        return
      }

      setIsScanning(true)
      setError(null)

      const result = await scanCode()

      if (result.value) {
        // Navigate to confirm page with the scanned coupon_id
        router.push(`/coupon-confirm/${encodeURIComponent(result.value)}`)
      } else {
        setError('ไม่สามารถอ่าน QR Code ได้ โปรดลองใหม่อีกครั้ง')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'ไม่สามารถเปิดกล้องสแกน QR Code ได้'
      setError(errorMsg)
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7f5]">
      <PageHeader />

      <main className="max-w-sm mx-auto px-4 py-4">
        {/* Back nav */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/profile" className="p-1 rounded-full hover:bg-[#e8f0e8] transition-colors">
            <ArrowLeft size={22} className="text-[#154212]" strokeWidth={2.5} />
          </Link>
          <h1 className="text-lg font-bold text-[#154212]">สแกนคูปอง</h1>
        </div>

        {/* Scanner card */}
        <div className="bg-white rounded-3xl shadow-md p-8 flex flex-col items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-[#e8f5e2] flex items-center justify-center">
            <QrCode size={40} className="text-[#154212]" />
          </div>

          <div className="text-center">
            <h2 className="text-base font-bold text-[#154212] mb-1">สแกน QR Code คูปอง</h2>
            <p className="text-sm text-[#666666] leading-relaxed">
              สแกน QR Code จากคูปองของผู้ใช้<br />เพื่อยืนยันการรับของรางวัล
            </p>
          </div>

          {isInClient ? (
            !isReady ? (
              <div className="w-full bg-[#fff3cd] border border-[#ffc107] rounded-xl p-4 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-[#ff9800] animate-spin flex-shrink-0" />
                <p className="text-sm text-[#666666]">LIFF กำลังโหลด...</p>
              </div>
            ) : (
              <Button
                onClick={handleScanQR}
                disabled={isScanning}
                className="w-full bg-[#154212] hover:bg-[#0d3308] text-white h-12 rounded-xl text-base font-semibold"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    กำลังเปิดกล้อง...
                  </>
                ) : (
                  'เปิดกล้องสแกน'
                )}
              </Button>
            )
          ) : (
            <div className="w-full bg-[#fef3cd] border border-[#ffc107] rounded-xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-[#ff9800] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#666666]">ฟีเจอร์สแกน QR Code ใช้งานได้เฉพาะในแอป LINE เท่านั้น</p>
            </div>
          )}

          {error && (
            <div className="w-full bg-[#ffebee] border border-[#f44336] rounded-xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-[#f44336] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[#c62828] mb-1">เกิดข้อผิดพลาด</p>
                <p className="text-sm text-[#c62828]">{error}</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
