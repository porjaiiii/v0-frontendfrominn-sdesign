'use client'

import { CheckSquare } from 'lucide-react'

interface SaveSuccessModalProps {
  isOpen: boolean
  onReturnToLine: () => void
}

export function SaveSuccessModal({ isOpen, onReturnToLine }: SaveSuccessModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#e5e5e5]">
          <h2 className="text-lg font-semibold text-[#333333] text-center">บันทึกข้อมูลสำเร็จ</h2>
        </div>

        {/* Body */}
        <div className="px-6 py-8 flex flex-col items-center gap-4 text-center">
          {/* Checkbox / checkmark icon */}
          <div className="w-12 h-12 flex items-center justify-center text-[#154212]">
            <CheckSquare className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-[#555555] leading-relaxed">
              ระบบได้บันทึกข้อมูลเรียบร้อยแล้ว<br />
              ขอบคุณที่ส่งข้อมูลเข้ามา<br />
              เจ้าหน้าที่จะเข้าดำเนินการเก็บและรับขยะในภายหลัง
            </p>
          </div>

          <p className="text-sm text-[#999999]">รอการตรวจสอบ...</p>
        </div>

        {/* Return to LINE button */}
        <div className="px-6 pb-6">
          <button
            onClick={onReturnToLine}
            className="w-full py-3.5 rounded-full font-bold bg-[#06C755] text-white text-base hover:bg-[#05a848] transition-colors shadow-md"
          >
            กลับสู่ line ...
          </button>
        </div>
      </div>
    </div>
  )
}
