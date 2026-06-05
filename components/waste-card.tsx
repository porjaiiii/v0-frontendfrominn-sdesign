'use client'

import Image from 'next/image'
import { CheckCircle2, Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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

interface WasteCardProps {
  record: WasteRecord
  onEdit: (record: WasteRecord) => void
  onSave: (record: WasteRecord) => void
  isSaving?: boolean
}

const WASTE_TYPE_COLORS: Record<string, string> = {
  plastic: 'bg-[#e8f3e6] text-[#154212]',
  paper: 'bg-[#fff4e6] text-[#8b6f47]',
  glass: 'bg-[#e8f0f7] text-[#1a4d8f]',
  aluminum: 'bg-[#f0f0f0] text-[#666666]',
  oil: 'bg-[#fff9e6] text-[#c4a300]',
}

export function WasteCard({ record, onEdit, onSave, isSaving = false }: WasteCardProps) {
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 space-y-4">
      {/* Image Section */}
      {record.image_url && (
        <div className="rounded-lg overflow-hidden h-40 bg-gray-100 flex items-center justify-center border-2 border-[#154212]">
          <Image
            src={record.image_url}
            alt={`${record.waste_type} - ${record.waste_subtype}`}
            width={300}
            height={200}
            className="w-full h-full object-cover"
            onError={(e) => {
              const img = e.target as HTMLImageElement
              img.style.display = 'none'
              const parent = img.parentElement
              if (parent) {
                const placeholder = document.createElement('div')
                placeholder.className = 'flex flex-col items-center justify-center gap-2'
                placeholder.innerHTML = '<svg class="w-12 h-12 text-[#999999]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
                parent.appendChild(placeholder)
              }
            }}
          />
        </div>
      )}

      {/* Fixed Data Display */}
      <div className="space-y-3">
        {/* Waste Type */}
        <div>
          <p className="text-xs text-[#666666] font-medium mb-1">ประเภทขยะ</p>
          <div className="flex items-center justify-between">
            <span className={cn(
              'inline-block px-3 py-1 rounded-full text-xs font-semibold',
              WASTE_TYPE_COLORS[record.waste_type] || 'bg-[#f0f0f0] text-[#666666]'
            )}>
              {record.waste_type}
            </span>
            <span className="text-xs text-[#999999]">พลาสติก</span>
          </div>
        </div>

        {/* Waste Subtype */}
        <div>
          <p className="text-xs text-[#666666] font-medium mb-1">ประเภทย่อย</p>
          <div className="bg-white border border-[#d4d4d4] rounded-lg px-3 py-2 text-sm text-[#154212] font-semibold">
            {record.waste_subtype} ({record.waste_type.toUpperCase()})
          </div>
        </div>

        {/* Weight */}
        <div>
          <p className="text-xs text-[#666666] font-medium mb-1">ระบน้ำหนัก (กก.)</p>
          <div className="bg-white border border-[#d4d4d4] rounded-lg px-3 py-2 text-lg font-bold text-[#154212]">
            {record.weight_kg}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onEdit(record)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-[#d4d4d4] text-[#666666] font-semibold rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Edit2 size={16} />
          <span>แก้ไข</span>
        </button>
        <button
          onClick={() => onSave(record)}
          disabled={isSaving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#154212] text-white font-semibold rounded-lg hover:bg-[#0f300c] transition-colors disabled:opacity-50"
        >
          <CheckCircle2 size={16} />
          <span>{isSaving ? 'กำลัง...' : 'บันทึก'}</span>
        </button>
      </div>
    </div>
  )
}
