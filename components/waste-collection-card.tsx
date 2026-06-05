'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Check, Edit2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface WasteRecord {
  timestamp: string
  user_id: string
  waste_type: string
  waste_subtype: string
  weight_kg: number
  image_url: string
  carbon_reduction: number
  points_earned: number
  status: string
}

interface WasteCollectionCardProps {
  record: WasteRecord
  onConfirm?: (record: WasteRecord) => void
  isConfirming?: boolean
}

const WASTE_TYPE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  plastic: { bg: 'bg-[#e8f3e6]', text: 'text-[#154212]', icon: '♻️' },
  paper: { bg: 'bg-[#fff4e6]', text: 'text-[#8b6f47]', icon: '📄' },
  glass: { bg: 'bg-[#e8f0f7]', text: 'text-[#1a4d8f]', icon: '🥤' },
  aluminum: { bg: 'bg-[#f0f0f0]', text: 'text-[#666666]', icon: '🔗' },
  oil: { bg: 'bg-[#fff9e6]', text: 'text-[#c4a300]', icon: '⛽' },
}

export function WasteCollectionCard({
  record,
  onConfirm,
  isConfirming = false,
}: WasteCollectionCardProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const typeColor = WASTE_TYPE_COLORS[record.waste_type] || {
    bg: 'bg-[#f0f0f0]',
    text: 'text-[#666666]',
    icon: '📦',
  }

  const handleConfirm = async () => {
    if (onConfirm) {
      setIsDeleting(true)
      onConfirm(record)
      // Reset after animation
      setTimeout(() => setIsDeleting(false), 300)
    }
  }

  const handleEdit = () => {
    // Navigate to edit page with record data
    router.push(
      `/waste-edit?timestamp=${encodeURIComponent(record.timestamp)}&userId=${record.user_id}`
    )
  }

  return (
    <div
      className={cn(
        'bg-white border border-[#d4d4d4] rounded-2xl p-4 transition-all duration-300',
        isDeleting && 'opacity-50 scale-95'
      )}
    >
      <div className="flex gap-4">
        {/* Left Square - Waste Type Info */}
        <div
          className={cn(
            'w-24 h-24 rounded-lg flex flex-col items-center justify-center flex-shrink-0 border-2',
            typeColor.bg,
            typeColor.text
          )}
        >
          <div className="text-3xl mb-1">
            {typeColor.icon}
          </div>
          <div className="text-center space-y-0.5">
            <p className="text-xs font-semibold capitalize">
              {record.waste_type}
            </p>
            <p className="text-[10px] font-medium opacity-75 line-clamp-1">
              {record.waste_subtype}
            </p>
            <p className="text-xs font-bold pt-1 border-t border-current/20">
              {record.weight_kg} กก.
            </p>
          </div>
        </div>

        {/* Right Section - Details & Buttons */}
        <div className="flex-1 flex flex-col justify-between">
          {/* Top Info */}
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-[#666666] font-medium">ประเภท</p>
                <p className="text-sm font-semibold text-[#154212]">
                  {record.waste_type}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#666666] font-medium">คาร์บอน</p>
                <p className="text-sm font-semibold text-[#154212]">
                  {(record.carbon_reduction ?? 0).toFixed(1)} kg
                </p>
              </div>
            </div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-[#666666] font-medium">ประเภทย่อย</p>
                <p className="text-sm font-semibold text-[#154212] line-clamp-1">
                  {record.waste_subtype}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#666666] font-medium">คะแนน</p>
                <p className="text-sm font-semibold text-[#154212]">
                  +{record.points_earned}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Buttons */}
          <div className="flex gap-2 pt-3">
            <button
              onClick={handleEdit}
              disabled={isConfirming || isDeleting}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-[#d4d4d4] text-[#666666] font-semibold rounded-xl hover:bg-[#f5f5f5] transition-colors disabled:opacity-50 text-sm"
            >
              <Edit2 size={16} />
              <span>แก้ไข</span>
            </button>
            {record.status === 'pending' && (
              <button
                onClick={handleConfirm}
                disabled={isConfirming || isDeleting}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#154212] text-white font-semibold rounded-xl hover:bg-[#0f300c] transition-colors disabled:opacity-50 text-sm"
              >
                <Check size={16} />
                <span>{isConfirming ? 'บันทึก...' : 'ยืนยัน'}</span>
              </button>
            )}
            {record.status !== 'pending' && (
              <div className="flex-1 flex items-center justify-center px-3 py-2 bg-[#e8f3e6] text-[#154212] font-semibold rounded-xl text-sm">
                ✓ เสร็จสิ้น
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
