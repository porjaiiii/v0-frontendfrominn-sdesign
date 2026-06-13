'use client'

import { RecycleIcon } from 'lucide-react'

interface ConfirmIncompleteModalProps {
  isOpen: boolean
  onEdit: () => void
  onConfirm: () => void
}

export function ConfirmIncompleteModal({ isOpen, onEdit, onConfirm }: ConfirmIncompleteModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#e5e5e5]">
          <h2 className="text-lg font-semibold text-[#154212] text-center">ยืนยันการบันทึก</h2>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col items-center gap-4 text-center">
          {/* Recycle icon */}
          <div className="w-12 h-12 flex items-center justify-center text-[#154212]">
            <RecycleIcon className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <p className="text-base font-semibold text-[#333333]">
              ข้อมูลบางส่วนยังไม่ได้ถูกระบุ
            </p>
            <p className="text-sm text-[#666666] leading-relaxed">
              ท่านสามารถดำเนินการต่อได้ โดยเจ้าหน้าที่<br />
              จะตรวจสอบข้อมูลเพิ่มเติมเมื่อเข้ารับขยะ
            </p>
          </div>

          {/* Bonus tip box */}
          <div className="w-full bg-[#2d4a1e] rounded-2xl px-4 py-3 text-left">
            <div className="flex items-center gap-2 mb-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/tabler-icon-mood-bitcoin-HLofjHsAUvOhEQ6Uow7dJJSnK5qv2O.png"
                alt="mood bitcoin icon"
                className="w-5 h-5 flex-shrink-0"
              />
              <p className="text-xs font-bold text-[#c8e86a]">
                กรอกครบ รับคะแนนเพิ่ม :
              </p>
            </div>
            <p className="text-xs text-white leading-relaxed">
              การระบุรายละเอียดขยะให้ครบถ้วนจะได้รับคะแนนสะสม เพิ่มเติมเป็นพิเศษซึ่งสามารถนำไปแลกรับของรางวัลต่าง ๆ ได้
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onEdit}
            className="flex-1 py-3 rounded-xl font-semibold border-2 border-[#154212] text-[#154212] text-sm hover:bg-[#f0fdf0] transition-colors"
          >
            แก้ไข
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl font-semibold bg-[#154212] text-white text-sm hover:bg-[#0d3308] transition-colors"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  )
}
