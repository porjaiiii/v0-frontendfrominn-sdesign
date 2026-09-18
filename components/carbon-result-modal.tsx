'use client'

import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useEffect, useState } from 'react'

interface CarbonResultModalProps {
  isOpen: boolean
  onClose: () => void
  /** null when the live rates never loaded, so no estimate can be shown. */
  carbonAmount: number | null
  noWeight?: boolean
  pointsEarned?: number | null
  showQR?: boolean
  qrData?: string
  onSubmit?: () => void
  onNext?: () => void
}

type CollectionMethod = 'pickup' | 'dropoff'

export function CarbonResultModal({
  isOpen,
  onClose,
  carbonAmount,
  noWeight = false,
  pointsEarned,
  showQR = false,
  qrData,
  onSubmit,
  onNext,
}: CarbonResultModalProps) {
  const router = useRouter()
  const [collectionMethod, setCollectionMethod] = useState<CollectionMethod | null>(null)

  useEffect(() => {
    if (isOpen) {
      setCollectionMethod(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  // "—" rather than 0: a carbon figure of zero reads as "you saved nothing",
  // which is a different claim from "the rate could not be loaded".
  const carbonText = carbonAmount === null ? '—' : carbonAmount.toFixed(0)
  const treesEquivalent = carbonAmount === null ? null : Math.floor(carbonAmount / 9.5)

  const handleDone = () => {
    if (!collectionMethod) return

    if (onNext) onNext()
    else onClose()
  }

  const methodOptions: Array<{
    id: CollectionMethod
    label: string
    detail: string
    icon: string
  }> = [
    {
      id: 'pickup',
      label: 'นำรับขยะ',
      detail: 'เจ้าหน้าที่จะเข้ารับขยะที่บ้านของคุณ',
      icon: '🏠',
    },
    {
      id: 'dropoff',
      label: 'ส่งขยะเลย',
      detail: 'นำขยะมาส่งที่จุดรับขยะตามเวลาที่กำหนด',
      icon: '📍',
    },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-[#f7f7f7] rounded-[24px] sm:rounded-[30px] w-full max-w-[380px] max-h-[90vh] overflow-y-auto border-[2px] border-[#1f8f47]/40 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
        {/* หัวข้อ */}
        <div className="px-4 pt-4 pb-1 bg-[#f7f7f7] mx-3 mt-2 rounded-[16px] flex flex-col items-center gap-1 text-center">
          <div className="text-[32px] leading-none">&#127807;</div>
          <h2 className="text-[20px] font-bold text-[#154212] leading-tight tracking-tight">
            บันทึกข้อมูลสำเร็จ
          </h2>
        </div>

        {/* รายละเอียด */}
        <div className="px-4 py-2">
          <p className="text-center text-[13px] leading-relaxed text-[#333333]">
            ระบบได้บันทึกข้อมูลเรียบร้อยแล้ว<br />
            ขอบคุณที่ส่งข้อมูลเข้ามา<br />
            เจ้าหน้าที่จะเข้าดำเนินการเก็บและรับขยะในภายหลัง
          </p>
        </div>

        {/* สรุปผลคาร์บอน */}
        {!noWeight && (
          <div className="px-4 pb-2">
            <div className="rounded-[16px] bg-[#f7f7f7] px-3 py-3 border border-gray-100">
              <h3 className="text-center text-[18px] font-bold text-[#111111] leading-tight">
                สรุปผลคาร์บอน
              </h3>
              <p className="mt-0.5 text-center text-[12px] text-[#444444]">
                คุณช่วยลดการปล่อยก๊าซเรือนกระจกได้
              </p>

              <div className="mt-1 text-center">
                <span className="block text-[44px] font-black leading-[0.9] tracking-[-0.06em] text-[#111111]">
                  {carbonText}
                </span>
                <span className="mt-1 block text-[16px] font-semibold text-[#111111]">kgCO2e</span>
              </div>

              <div className="mt-2 flex items-center justify-center gap-2 rounded-[12px] bg-[#f1f4f1] p-2 text-center">
                <div className="relative h-8 w-8 shrink-0">
                  <Image src="/images/trees-3d.png" alt="ต้นไม้" fill className="object-contain" />
                </div>
                <p className="text-[12px] leading-snug text-[#2b2b2b]">
                  เทียบเท่ากับคุณช่วยบำรุง<br />
                  ปลูกต้นไม้เพิ่ม {treesEquivalent ?? '—'} ต้นแล้ว!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ปุ่มตัวเลือก (ไอคอนซ้าย, เตี้ยลง, สดสีเขียวเมื่อเลือก) */}
        <div className="px-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            {methodOptions.map((option) => {
              const selected = collectionMethod === option.id

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setCollectionMethod(option.id)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-[14px] border-[2px] px-3 py-2 transition-all duration-200',
                    selected
                      ? 'border-[#1d7f36] bg-[#1d7f36] text-white shadow-[0_4px_12px_rgba(29,127,54,0.22)]'
                      : 'border-[#d5d5d5] bg-[#f5f5f5] text-[#111111] hover:border-[#86bde3] hover:bg-[#eef7ff]'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base',
                      selected ? 'bg-white/20' : 'bg-white'
                    )}
                  >
                    {option.icon}
                  </span>
                  <span className="text-[14px] font-bold leading-tight">{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* หมายเหตุวันที่ */}
        <div className="px-4 pb-2 text-center">
          <p className="text-[12px] text-[#111111] leading-relaxed">
            เจ้าหน้าที่จะเข้ามารับขยะวันที่ 23 กันยายน 2569<br />
            เวลา 10.00 - 16.00 น.
          </p>
          <p className="mt-1 text-[11px] font-medium text-[#d02b2b]">
            * หมายเหตุ : หากไม่สะดวกวันเวลาดังกล่าว โปรดแจ้งผ่านไลน์ *
          </p>
        </div>

        {/* ปุ่มเสร็จสิ้น */}
        {collectionMethod && (
          <div className="px-4 pb-4 pt-1">
            <button
              type="button"
              onClick={handleDone}
              className="w-full rounded-[14px] bg-[#1d7f36] py-2.5 text-[18px] font-bold text-white shadow-[0_8px_16px_rgba(29,127,54,0.25)] transition-all hover:bg-[#186b2d]"
            >
              เสร็จสิ้น
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
