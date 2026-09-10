'use client'

import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState } from 'react'

interface CarbonResultModalProps {
  isOpen: boolean
  onClose: () => void
  carbonAmount: number
  noWeight?: boolean
  pointsEarned?: number
  showQR?: boolean
  qrData?: string
  onSubmit?: () => void
  onNext?: () => void
}

export function CarbonResultModal({
  isOpen,
  onClose,
  carbonAmount,
  noWeight = false,
  pointsEarned = 100,
  showQR = false,
  qrData,
  onSubmit,
  onNext,
}: CarbonResultModalProps) {
  const router = useRouter()
  const [collectionMethod, setCollectionMethod] = useState<string | null>(null)

  if (!isOpen) return null

  const treesEquivalent = Math.floor(carbonAmount / 9.5)

  const handleHistory = () => {
    onClose()
    router.push('/history')
  }

  const handleDone = () => {
    if (!collectionMethod) return

    if (onNext) onNext()
    else onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 sm:items-center sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm overflow-hidden">
        {/* Success header with seedling icon on top */}
        <div className="px-6 pt-6 pb-4 border-b border-[#e5e5e5] flex flex-col items-center gap-2">
          <div className="text-4xl">&#127807;</div>
          <h2 className="text-lg font-semibold text-[#154212]">บันทึกข้อมูลสำเร็จ</h2>
        </div>

        {noWeight ? (
          /* Simple popup when weight is unknown */
          <div className="px-6 py-8 flex flex-col items-center text-center gap-4">
            <p className="text-sm text-[#555555] leading-relaxed">
              ระบบได้บันทึกข้อมูลเรียบร้อยแล้ว<br />
              ขอบคุณที่ส่งข้อมูลเข้ามา<br />
              เจ้าหน้าที่จะเข้าดำเนินการเก็บและรับขยะในภายหลัง
            </p>
          </div>
        ) : (
          /* Full carbon summary when weight is known */
          <div className="px-6 py-6 space-y-6">
            {/* Success message */}
            <div className="flex flex-col items-center text-center gap-3">
              <p className="text-sm text-[#555555] leading-relaxed">
                ระบบได้บันทึกข้อมูลเรียบร้อยแล้ว<br />
                ขอบคุณที่ส่งข้อมูลเข้ามา<br />
                เจ้าหน้าที่จะเข้าดำเนินการเก็บและรับขยะในภายหลัง
              </p>
            </div>

            {/* Collection method selector (visual placeholder for the next flow) */}
            <div className="space-y-3">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-[#111111]">ต้องการส่งขยะแบบไหน?</h3>
                <p className="mt-1 text-sm text-[#d00000]">*โปรดระบุ</p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  aria-pressed={collectionMethod === 'walk-in'}
                  onClick={() => setCollectionMethod('walk-in')}
                  className={cn(
                    'w-full rounded-2xl border-2 px-4 py-2.5 text-center transition-colors',
                    collectionMethod === 'walk-in'
                      ? 'border-[#16851a] bg-[#c5e2c2]'
                      : 'border-[#16851a] bg-[#d5ead2] hover:bg-[#c5e2c2]'
                  )}
                >
                  <span className="block text-lg font-semibold text-[#111111]">
                    📍 นำมาส่งด้วยตนเอง (Walk-in)
                  </span>
                  <span className="block text-sm font-medium text-[#111111]">
                    นำขยะมาส่งที่จุดรับขยะตามเวลาที่กำหนด
                  </span>
                </button>

                <button
                  type="button"
                  aria-pressed={collectionMethod === 'pickup'}
                  onClick={() => setCollectionMethod('pickup')}
                  className={cn(
                    'w-full rounded-2xl border-2 px-4 py-2.5 text-center transition-colors',
                    collectionMethod === 'pickup'
                      ? 'border-[#16851a] bg-[#c5e2c2]'
                      : 'border-[#16851a] bg-[#d5ead2] hover:bg-[#c5e2c2]'
                  )}
                >
                  <span className="block text-lg font-semibold text-[#111111]">
                    🏠 ให้เจ้าหน้าที่เข้ารับ
                  </span>
                  <span className="block text-sm font-medium text-[#111111]">
                    เลือกวันและเวลาที่สะดวก
                  </span>
                </button>
              </div>
            </div>

            {/* Carbon summary */}
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-[#154212]">สรุปผลคาร์บอน</h3>
              <p className="text-sm text-[#555555]">คุณช่วยลดการปล่อยก๊าซเรือนกระจกได้</p>

              {/* Big number */}
              <div className="text-center py-4">
                <span className="text-7xl font-bold text-[#154212] leading-none">
                  {Number(carbonAmount || 0).toFixed(2)}
                </span>
              </div>

              <p className="text-center text-2xl font-semibold text-[#444444]">kgCO2e</p>
            </div>

            {/* Tree comparison box with 3D tree image */}
            <div className="bg-[#f5f5f5] rounded-2xl p-4 flex items-center gap-3">
              <div className="relative w-14 h-14 shrink-0">
                <Image src="/images/trees-3d.png" alt="ต้นไม้" fill className="object-contain" />
              </div>
              <p className="text-sm text-[#444444] leading-snug">
                เทียบเท่ากับคุณช่วยบางเจ้า<br />
                ปลูกต้นไม้เพิ่ม {treesEquivalent} ต้นแล้ว!
              </p>
            </div>
          </div>
        )}

        {/* Footer buttons */}
        <div className="px-6 pb-8 flex gap-3">
      
          <button
            type="button"
            onClick={handleDone}
            disabled={!noWeight && !collectionMethod}
            className={cn(
              'flex-1 py-3 rounded-full font-semibold text-sm transition-colors',
              !noWeight && !collectionMethod
                ? 'cursor-not-allowed bg-[#d1d5db] text-[#6b7280]'
                : 'bg-[#154212] text-white hover:bg-[#0d3308]'
            )}
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  )
}
