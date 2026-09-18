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
      label: 'นัดรับขยะ',
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
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 sm:items-center sm:p-4">
      <div className="bg-[#f7f7f7] rounded-t-[30px] sm:rounded-[30px] w-full max-w-[420px] overflow-hidden border-[2px] border-[#1f8f47]/40 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
        <div className="px-6 pt-6 pb-4 bg-[#f7f7f7] mx-4 mt-4 rounded-[18px] flex flex-col items-center gap-3 text-center">
          <div className="text-[46px] leading-none">&#127807;</div>
          <h2 className="text-[26px] font-bold text-[#154212] leading-tight tracking-tight">
            บันทึกข้อมูลสำเร็จ
          </h2>
        </div>

        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <p className="text-center text-[15px] leading-relaxed text-[#333333]">
            ระบบได้บันทึกข้อมูลเรียบร้อยแล้ว<br />
            ขอบคุณที่ส่งข้อมูลเข้ามา<br />
            เจ้าหน้าที่จะเข้าดำเนินการเก็บและรับขยะในภายหลัง
          </p>
        </div>

        {!noWeight && (
          <div className="px-5 pb-5 sm:px-6">
            <div className="rounded-[18px] bg-[#f7f7f7] px-4 py-5">
              <h3 className="text-center text-[30px] font-bold text-[#111111] leading-tight">
                สรุปผลคาร์บอน
              </h3>
              <p className="mt-2 text-center text-[16px] text-[#444444]">
                คุณช่วยลดการปล่อยก๊าซเรือนกระจกได้
              </p>

              <div className="mt-4 text-center">
                <span className="block text-[76px] font-black leading-[0.9] tracking-[-0.06em] text-[#111111]">
                  {carbonText}
                </span>
                <span className="mt-2 block text-[26px] font-semibold text-[#111111]">kgCO2e</span>
              </div>

              <div className="mt-5 flex items-center justify-center gap-3 rounded-[14px] bg-[#f1f4f1] p-3 text-center">
                <div className="relative h-12 w-12 shrink-0">
                  <Image src="/images/trees-3d.png" alt="ต้นไม้" fill className="object-contain" />
                </div>
                <p className="text-[15px] leading-relaxed text-[#2b2b2b]">
                  เทียบเท่ากับคุณช่วยบำรุง<br />
                  ปลูกต้นไม้เพิ่ม {treesEquivalent ?? '—'} ต้นแล้ว!
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 pb-4 sm:px-6">
          <div className="grid grid-cols-2 gap-3">
            {methodOptions.map((option) => {
              const selected = collectionMethod === option.id

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setCollectionMethod(option.id)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 rounded-[18px] border-[2px] p-4 text-center transition-all duration-200',
                    selected
                      ? option.id === 'pickup'
                        ? 'border-[#1d7f36] bg-[#1d7f36] text-white shadow-[0_8px_18px_rgba(29,127,54,0.22)]'
                        : 'border-[#d5d5d5] bg-[#f0f0f0] text-[#111111] shadow-[0_8px_18px_rgba(0,0,0,0.08)]'
                      : 'border-[#d5d5d5] bg-[#f5f5f5] text-[#111111] hover:border-[#86bde3] hover:bg-[#eef7ff]'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-10 w-10 items-center justify-center rounded-full text-xl',
                      selected && option.id === 'pickup' ? 'bg-white/20' : 'bg-white'
                    )}
                  >
                    {option.icon}
                  </span>
                  <span className="text-[16px] font-bold leading-tight">{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="px-5 pb-5 text-center sm:px-6">
          <p className="text-[16px] text-[#111111] leading-relaxed">
            เจ้าหน้าที่จะเข้ามารับขยะในสัปดาถัดไปตามตาราง<br />
            เวลา 10.00 - 16.00 น.
          </p>
          <p className="mt-3 text-[15px] font-medium text-[#d02b2b]">
            * หมายเหตุ : หากไม่สะดวกวันเวลาดังกล่าว โปรดแจ้งผ่านไลน์ *
          </p>
        </div>

        {collectionMethod && (
          <div className="px-5 pb-6 sm:px-6">
            <button
              type="button"
              onClick={handleDone}
              className="w-full rounded-[18px] bg-[#1d7f36] py-4 text-[24px] font-bold text-white shadow-[0_12px_24px_rgba(29,127,54,0.25)] transition-all hover:bg-[#186b2d]"
            >
              เสร็จสิ้น
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
