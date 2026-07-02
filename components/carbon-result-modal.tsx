'use client'

import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

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

  if (!isOpen) return null

  const treesEquivalent = Math.max(1, Math.ceil(carbonAmount / 9.5))

  const handleHistory = () => {
    onClose()
    router.push('/history')
  }

  const handleDone = () => {
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

            {/* Carbon summary */}
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-[#154212]">สรุปผลคาร์บอน</h3>
              <p className="text-sm text-[#555555]">คุณช่วยลดการปล่อยก๊าซเรือนกระจกได้</p>

              {/* Big number */}
              <div className="text-center py-4">
                <span className="text-7xl font-bold text-[#154212] leading-none">
                  {carbonAmount.toFixed(0)}
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
            onClick={handleDone}
            className="flex-1 py-3 rounded-full font-semibold bg-[#154212] text-white text-sm hover:bg-[#0d3308] transition-colors"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  )
}
