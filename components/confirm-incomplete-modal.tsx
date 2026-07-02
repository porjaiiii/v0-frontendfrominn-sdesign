'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmIncompleteModalProps {
  isOpen: boolean
  onEdit: () => void
  onConfirm: () => void
}

export function ConfirmIncompleteModal({ isOpen, onEdit, onConfirm }: ConfirmIncompleteModalProps) {
  const [showBonusDetail, setShowBonusDetail] = useState(false)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#e5e5e5]">
          <h2 className="text-xl font-semibold text-[#154212] text-center">ข้อมูลยังไม่ครบ แต่บันทึกได้เลย</h2>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col items-center gap-5 text-center">
          <div className="space-y-2">
            <p className="text-base text-[#555555] leading-relaxed">
              ไม่ต้องกังวลนะคะ<br />
              เดี๋ยวเจ้าหน้าที่จะตรวจให้ตอนมารับขยะ
            </p>
          </div>

          {/* Bonus tip box */}
          <div className="w-full bg-[#357a1e] rounded-2xl px-4 py-4 text-center">
            <div className="flex items-center justify-center gap-2">
              {/* sparkle icon — inlined from public/icons/sparkle.svg so it can take the lime color */}
              <svg
                className="w-7 h-7 flex-shrink-0 text-[#e6ff8a]"
                viewBox="0 0 19 18"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 15C14.5304 15 15.0391 15.2107 15.4142 15.5858C15.7893 15.9609 16 16.4696 16 17C16 16.4696 16.2107 15.9609 16.5858 15.5858C16.9609 15.2107 17.4696 15 18 15C17.4696 15 16.9609 14.7893 16.5858 14.4142C16.2107 14.0391 16 13.5304 16 13C16 13.5304 15.7893 14.0391 15.4142 14.4142C15.0391 14.7893 14.5304 15 14 15ZM14 3C14.5304 3 15.0391 3.21071 15.4142 3.58579C15.7893 3.96086 16 4.46957 16 5C16 4.46957 16.2107 3.96086 16.5858 3.58579C16.9609 3.21071 17.4696 3 18 3C17.4696 3 16.9609 2.78929 16.5858 2.41421C16.2107 2.03914 16 1.53043 16 1C16 1.53043 15.7893 2.03914 15.4142 2.41421C15.0391 2.78929 14.5304 3 14 3ZM7 15C7 13.4087 7.63214 11.8826 8.75736 10.7574C9.88258 9.63214 11.4087 9 13 9C11.4087 9 9.88258 8.36786 8.75736 7.24264C7.63214 6.11742 7 4.5913 7 3C7 4.5913 6.36786 6.11742 5.24264 7.24264C4.11742 8.36786 2.5913 9 1 9C2.5913 9 4.11742 9.63214 5.24264 10.7574C6.36786 11.8826 7 13.4087 7 15Z" />
              </svg>
              <p className="text-lg font-bold text-[#e6ff8a]">
                กรอกครบ รับคะแนนเพิ่ม
              </p>
            </div>

            {/* Dropdown toggle for the detailed explanation */}
            <button
              type="button"
              onClick={() => setShowBonusDetail((v) => !v)}
              className="mt-2 mx-auto flex items-center justify-center gap-1 text-xs font-normal text-white/60 hover:text-white/90 transition-colors"
              aria-expanded={showBonusDetail}
            >
              {showBonusDetail ? 'ซ่อน' : 'ดูเพิ่มเติม'}
              <ChevronDown
                className={cn('w-4 h-4 transition-transform', showBonusDetail && 'rotate-180')}
              />
            </button>

            {showBonusDetail && (
              <p className="mt-2.5 text-base text-white leading-relaxed">
                กรอกรายละเอียดขยะให้ครบถ้วน จะได้รับคะแนนสะสมเพิ่มเป็นพิเศษ นำไปแลกของรางวัลต่าง ๆ ได้
              </p>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onEdit}
            className="flex-1 py-3.5 rounded-xl font-semibold border-2 border-[#154212] text-[#154212] text-base hover:bg-[#f0fdf0] transition-colors"
          >
            แก้ไข
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-xl font-semibold bg-[#154212] text-white text-base hover:bg-[#0d3308] transition-colors"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  )
}
