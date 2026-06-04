'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'
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

interface WasteDetailModalProps {
  record: WasteRecord | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (record: WasteRecord) => void
  isConfirming?: boolean
}

export function WasteDetailModal({
  record,
  isOpen,
  onClose,
  onConfirm,
  isConfirming = false,
}: WasteDetailModalProps) {
  if (!isOpen || !record) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="w-full bg-white rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header with Green Tab */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#154212] text-white px-4 py-2 rounded-lg font-semibold text-sm">
              ข้อมูลขยะ
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5">
          {/* Image with Fallback */}
          <div className="rounded-xl overflow-hidden h-40 bg-gray-100 flex items-center justify-center border-2 border-[#d4d4d4]">
            {record.image_url ? (
              <Image
                src={record.image_url}
                alt={`${record.waste_type} - ${record.waste_subtype}`}
                width={400}
                height={300}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.target as HTMLImageElement
                  img.style.display = 'none'
                  const parent = img.parentElement
                  if (parent) {
                    const placeholder = document.createElement('div')
                    placeholder.className = 'flex flex-col items-center justify-center gap-2'
                    placeholder.innerHTML = '<svg class="w-16 h-16 text-[#999999]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg><span class="text-[#666666] font-semibold text-sm">รูปไม่พบ</span>'
                    parent.appendChild(placeholder)
                  }
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2">
                <svg className="w-16 h-16 text-[#999999]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-[#666666] font-semibold text-sm">รูปไม่พบ</span>
              </div>
            )}
          </div>

          {/* Type Info - Read Only Display */}
          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">ประเภทขยะ</p>
            <div className="w-full bg-white border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold">
              {record.waste_type}
            </div>
          </div>

          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">ประเภทย่อย</p>
            <div className="w-full bg-white border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold">
              {record.waste_subtype}
            </div>
          </div>

          {/* Weight & Carbon */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[#666666] font-medium mb-2">น้ำหนัก</p>
              <div className="w-full bg-white border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold text-lg">
                {record.weight_kg}
              </div>
              <p className="text-xs text-[#666666] mt-1">kg</p>
            </div>
            <div>
              <p className="text-xs text-[#666666] font-medium mb-2">คาร์บอนลดลง</p>
              <div className="w-full bg-white border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold text-lg">
                {(record.carbon_reduction ?? 0).toFixed(1)}
              </div>
              <p className="text-xs text-[#666666] mt-1">kg CO2</p>
            </div>
          </div>

          {/* Points & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[#666666] font-medium mb-2">คะแนน</p>
              <div className="w-full bg-white border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold text-lg">
                +{record.points_earned}
              </div>
            </div>
            <div>
              <p className="text-xs text-[#666666] font-medium mb-2">สถานะ</p>
              <div className="w-full bg-white border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold capitalize">
                {record.status === 'pending' ? 'ยื่นคำร้อง กำลังรอการเก็บ' : record.status}
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">วันเวลาบันทึก</p>
            <div className="w-full bg-white border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold">
              {new Date(record.timestamp).toLocaleDateString('th-TH', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })} เวลา {new Date(record.timestamp).toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-[#d4d4d4] text-[#666666] font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              ยืองลับ
            </button>
            {record.status === 'pending' && (
              <button
                onClick={() => onConfirm(record)}
                disabled={isConfirming}
                className="flex-1 px-4 py-3 bg-[#154212] text-white font-semibold rounded-full hover:bg-[#0f300c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} />
                {isConfirming ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
