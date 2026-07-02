'use client'

import Image from 'next/image'
import { Camera } from 'lucide-react'

// 🌟 ปรับ Interface ให้ตรงกับระบบใหม่
interface WasteRecord {
  timestamp: string
  user_id: string
  waste_type: string
  waste_subtype: string
  weight_kg: number
  image_urls: string[] // เปลี่ยนจาก string เป็น string[]
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

const WASTE_TYPE_THAI: Record<string, string> = {
  plastic: 'พลาสติก',
  paper: 'กระดาษ',
  glass: 'แก้ว',
  aluminum: 'อลูมิเนียม',
  oil: 'น้ำมัน',
}

export function WasteCard({ record, onEdit, onSave, isSaving = false }: WasteCardProps) {
  console.log('WasteCard - Record data:', record);
  console.log('WasteCard - Image URLs:', record.image_urls);
  const wasteTypeThai = WASTE_TYPE_THAI[record.waste_type] || record.waste_type

  return (
    <div className="bg-white border border-[#cccccc] rounded-lg overflow-hidden">
      {/* Main Content */}
      <div className="flex gap-3 p-3">
        {/* Photo area — ปรับให้แสดงหลายรูปได้ */}
        <div className="flex-shrink-0 w-28 h-28 flex gap-1 overflow-x-auto">
          {record.image_urls && record.image_urls.length > 0 ? (
            record.image_urls.map((url, index) => (
              <div key={index} className="w-28 h-28 flex-shrink-0 rounded border border-[#cccccc] overflow-hidden">
                <Image
                  src={url}
                  alt={`${record.waste_type} - ${index + 1}`}
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                />
              </div>
            ))
          ) : (
            <div className="w-28 h-28 rounded border-2 border-dashed border-[#888888] flex flex-col items-center justify-center bg-white gap-1">
              <Camera size={28} className="text-[#888888]" />
              <p className="text-[9px] text-[#888888] text-center px-1">ไม่มีรูปภาพ</p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="flex-1 space-y-2 pt-1">
          <div className="flex justify-between items-start gap-2">
            <span className="text-xs text-[#154212] whitespace-nowrap">ประเภทขยะ</span>
            <span className="text-xs font-bold text-[#444444] text-right">{wasteTypeThai}</span>
          </div>

          <div className="flex justify-between items-start gap-2">
            <span className="text-xs text-[#154212] whitespace-nowrap">ประเภทย่อย</span>
            <span className="text-xs font-bold text-[#444444] text-right leading-tight">{record.waste_subtype}</span>
          </div>

          <div className="flex justify-between items-start gap-2">
            <span className="text-xs text-[#154212] whitespace-nowrap">ระบุน้ำหนัก (กก.)</span>
            <span className="text-xs font-bold text-[#444444]">{record.weight_kg === -1 ? 'ยังไม่ได้ระบุ' : record.weight_kg}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 px-3 pb-3">
        <button
          onClick={() => onEdit(record, true)}
          className="flex-1 py-2 border border-[#aaaaaa] text-[#444444] text-sm font-semibold rounded-md hover:bg-gray-50 transition-colors"
        >
          แก้ไข
        </button>
        <button
          onClick={() => onSave(record)}
          disabled={isSaving}
          className="flex-1 py-2 bg-[#154212] text-white text-sm font-semibold rounded-md hover:bg-[#0f300c] transition-colors disabled:opacity-50"
        >
          {isSaving ? 'กำลัง...' : 'ยืนยันข้อมูล'}
        </button>
      </div>
    </div>
  )
}