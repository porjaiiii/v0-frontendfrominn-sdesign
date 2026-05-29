'use client'

import { X, Leaf, CheckCircle, Gift, TreePine } from 'lucide-react'
import { useQRCode } from 'next-qrcode'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface CarbonResultModalProps {
  isOpen: boolean
  onClose: () => void
  carbonAmount: number
  pointsEarned?: number
  showQR?: boolean
  qrData?: string
  onSubmit?: () => void
}

export function CarbonResultModal({ 
  isOpen, 
  onClose, 
  carbonAmount, 
  pointsEarned = 100,
  showQR = false,
  qrData,
  onSubmit 
}: CarbonResultModalProps) {
  const { Canvas } = useQRCode()

  if (!isOpen) return null

  // Calculate equivalents
  const treesEquivalent = Math.ceil(carbonAmount / 5)
  const co2Saved = carbonAmount * 0.84
  const oilSaved = carbonAmount * 0.46
  const distanceEquivalent = carbonAmount * 4

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e5e5e5]">
          <h2 className="text-lg font-semibold text-[#154212]">สรุปผลคาร์บอน</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[#f5f5f5] transition-colors"
          >
            <X className="w-5 h-5 text-[#666666]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {showQR && qrData ? (
            <div className="text-center">
              <p className="text-sm text-[#444444] mb-2">
                คุณช่วยลดการปล่อยก๊าซเรือนกระจกได้
              </p>
              <p className="text-xs text-[#666666] mb-4">
                คุณสร้างคาร์บอนเครดิตด้วยการรีไซเคิล ระยะเวลาอยู่ 3 เดือน
              </p>
              
              <div className="inline-block p-4 bg-white rounded-xl shadow-lg border border-[#e5e5e5] mb-4">
                <Canvas
                  text={qrData}
                  options={{
                    errorCorrectionLevel: 'M',
                    margin: 2,
                    scale: 4,
                    width: 160,
                    color: {
                      dark: '#154212',
                      light: '#ffffff',
                    },
                  }}
                />
              </div>

              <p className="text-xs text-[#666666] leading-relaxed mb-4">
                ข้อมูลใช้ใช้สิทธิ์รางวัลกับคอร์เคดิตและติดต่อ
                <br />
                เมื่อถึงเวลาท่านจะได้รับจดหมายเพื่อยืนยันที่อยู่สำหรับรางวัล
                <br />
                ผ่าน ระบบ LINE
              </p>
            </div>
          ) : (
            <>
              {/* Carbon Amount Display */}
              <div className="text-center mb-6">
                <p className="text-sm text-[#444444] mb-2">
                  คุณช่วยลดการปล่อยก๊าซเรือนกระจกได้
                </p>
                
                <div className="flex items-center justify-center gap-2 my-4">
                  <Leaf className="w-8 h-8 text-[#157b03]" />
                  <span className="text-5xl font-bold text-[#154212]">
                    {carbonAmount.toFixed(0)}
                  </span>
                </div>
                
                <p className="text-lg font-medium text-[#444444]">kgCO2e</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#f0fdf0] rounded-xl p-3 text-center">
                  <Gift className="w-6 h-6 text-[#157b03] mx-auto mb-1" />
                  <p className="text-2xl font-bold text-[#154212]">{pointsEarned}</p>
                  <p className="text-xs text-[#666666]">แต้มสะสม</p>
                </div>
                <div className="bg-[#f0fdf0] rounded-xl p-3 text-center">
                  <TreePine className="w-6 h-6 text-[#157b03] mx-auto mb-1" />
                  <p className="text-2xl font-bold text-[#154212]">{treesEquivalent}</p>
                  <p className="text-xs text-[#666666]">ต้นไม้/ปี</p>
                </div>
              </div>

              {/* Equivalents List */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-[#444444]">
                  <CheckCircle className="w-4 h-4 text-[#157b03]" />
                  <span>ลดได้ {co2Saved.toFixed(2)} kg</span>
                </div>
                <div className="flex items-center gap-2 text-[#444444]">
                  <CheckCircle className="w-4 h-4 text-[#157b03]" />
                  <span>น้ำมัน {oilSaved.toFixed(2)} ลิตร</span>
                </div>
                <div className="flex items-center gap-2 text-[#444444]">
                  <CheckCircle className="w-4 h-4 text-[#157b03]" />
                  <span>ปลูกต้นไม้ {treesEquivalent} ต้น</span>
                </div>
                <div className="flex items-center gap-2 text-[#444444]">
                  <CheckCircle className="w-4 h-4 text-[#157b03]" />
                  <span>ระยะทาง {distanceEquivalent.toFixed(0)} km</span>
                </div>
              </div>

              {/* Rewards Preview */}
              <div className="mt-4 p-3 bg-gradient-to-r from-[#fff8e1] to-[#ffecb3] rounded-xl">
                <p className="text-sm font-semibold text-[#444444] mb-2">รางวัลที่สามารถแลกได้</p>
                <div className="flex gap-2 overflow-x-auto">
                  <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-white overflow-hidden relative">
                    <Image src="/images/rewards/eggs.jpg" alt="eggs" fill className="object-cover" />
                  </div>
                  <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-white overflow-hidden relative">
                    <Image src="/images/rewards/mama.jpg" alt="mama" fill className="object-cover" />
                  </div>
                  <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-white overflow-hidden relative">
                    <Image src="/images/rewards/rice-white.jpg" alt="rice" fill className="object-cover" />
                  </div>
                </div>
                <p className="text-xs text-[#666666] mt-2">
                  รางวัลมากมาย สะสมแต้มครบแล้วแลกเลย!
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e5e5e5] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-medium border border-[#e5e5e5] text-[#666666] hover:bg-[#f5f5f5] transition-colors"
          >
            ย้อนกลับ
          </button>
          <button
            onClick={onSubmit || onClose}
            className={cn(
              'flex-1 py-3 rounded-xl font-medium transition-colors',
              'bg-[#154212] text-white hover:bg-[#0d3308]'
            )}
          >
            {showQR ? 'เสร็จสิ้น' : 'ถัดไป'}
          </button>
        </div>
      </div>
    </div>
  )
}
