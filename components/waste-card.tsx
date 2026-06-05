'use client'

import Image from 'next/image'
import { CheckCircle2, Edit2, Camera } from 'lucide-react'
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
  onEdit: (record: WasteRecord, isEditing: boolean) => void
  onSave: (record: WasteRecord) => void
  isSaving?: boolean
}

// Mapping ประเภทขยะเป็นภาษาไทยธรรมชาติ
const WASTE_TYPE_THAI: Record<string, string> = {
  plastic: 'พลาสติก',
  paper: 'กระดาษ',
  glass: 'แก้ว',
  aluminum: 'อลูมิเนียม',
  oil: 'น้ำมัน',
}

export function WasteCard({ record, onEdit, onSave, isSaving = false }: WasteCardProps) {
  const wasteTypeThai = WASTE_TYPE_THAI[record.waste_type] || record.waste_type

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
      {/* Main Content - Flex Row */}
      <div className="flex gap-4 p-4">
        {/* Image Section - Left */}
        <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded flex items-center justify-center border border-[#d4d4d4]">
          {record.image_url ? (
            <Image
              src={record.image_url}
              alt={`${record.waste_type} - ${record.waste_subtype}`}
              width={96}
              height={96}
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.target as HTMLImageElement
                img.style.display = 'none'
              }}
            />
          ) : (
            <Camera size={32} className="text-[#999999]" />
          )}
        </div>

        {/* Data Section - Right */}
        <div className="flex-1 space-y-2">
          {/* Waste Type */}
          <div className="flex justify-between items-start">
            <span className="text-xs text-[#666666]">ประเภทขยะ</span>
            <span className="text-sm font-semibold text-[#154212]">{wasteTypeThai}</span>
          </div>

          {/* Waste Subtype */}
          <div className="flex justify-between items-start">
            <span className="text-xs text-[#666666]">ประเภทย่อย</span>
            <span className="text-sm font-semibold text-[#154212]">{record.waste_subtype}</span>
          </div>

          {/* Weight */}
          <div className="flex justify-between items-start">
            <span className="text-xs text-[#666666]">ระบุน้ำหนัก (กก.)</span>
            <span className="text-sm font-bold text-[#154212]">{record.weight_kg}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons - Full Width Bottom */}
      <div className="flex gap-3 p-4 border-t border-[#e5e5e5]">
        <button
          onClick={() => onEdit(record, true)}
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
          <span>{isSaving ? 'กำลัง...' : 'ยืนยืนอือบา'}</span>
        </button>
      </div>
    </div>
  )
}
