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
        <div className="space-y-6">
          {/* Image with Fallback */}
          <div className="rounded-xl overflow-hidden h-48 bg-gray-100 flex items-center justify-center border-2 border-[#154212]">
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
                    placeholder.innerHTML = '<svg class="w-16 h-16 text-[#154212]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg><span class="text-[#154212] font-semibold text-sm">รูปไม่พบ</span>'
                    parent.appendChild(placeholder)
                  }
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2">
                <svg className="w-16 h-16 text-[#154212]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-[#154212] font-semibold text-sm">รูปไม่พบ</span>
              </div>
            )}
          </div>

          {/* Type Info */}
          <div className="border-2 border-[#e5e5e5] rounded-xl p-4 space-y-3">
            <div>
              <p className="text-sm text-[#666666] mb-1">ประเภทขยะ</p>
              <p className="font-semibold text-[#154212]">{record.waste_type}</p>
            </div>
            <div className="border-t border-[#e5e5e5] pt-3">
              <p className="text-sm text-[#666666] mb-1">ประเภทย่อย</p>
              <p className="font-semibold text-[#154212]">{record.waste_subtype}</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 border-2 border-[#154212]">
              <p className="text-xs text-[#154212] mb-1 font-semibold">น้ำหนัก</p>
              <p className="text-2xl font-bold text-[#154212]">{record.weight_kg}</p>
              <p className="text-xs text-[#154212] mt-1">kg</p>
            </div>
            <div className="bg-white rounded-xl p-4 border-2 border-[#154212]">
              <p className="text-xs text-[#154212] mb-1 font-semibold">คาร์บอนลดลง</p>
              <p className="text-2xl font-bold text-[#154212]">
                {(record.carbon_reduction ?? 0).toFixed(1)}
              </p>
              <p className="text-xs text-[#154212] mt-1">kg CO2</p>
            </div>
          </div>

          {/* Points & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 border-2 border-[#154212]">
              <p className="text-xs text-[#154212] mb-1 font-semibold">คะแนน</p>
              <p className="text-2xl font-bold text-[#154212]">+{record.points_earned}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border-2 border-[#154212]">
              <p className="text-xs text-[#154212] mb-1 font-semibold">สถานะ</p>
              <p className="text-sm font-semibold text-[#154212] capitalize">
                {record.status === 'pending' ? 'รอการยืนยัน' : record.status}
              </p>
            </div>
          </div>

          {/* Timestamp */}
          <div className="border-2 border-[#154212] rounded-xl p-4 bg-white">
            <p className="text-sm text-[#154212] mb-2 font-semibold">วันเวลาบันทึก</p>
            <p className="font-semibold text-[#154212]">
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
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-[#154212] text-[#154212] font-semibold rounded-xl hover:bg-[#f0f9e8] transition-colors"
            >
              ยื่องลับ
            </button>
            {record.status === 'pending' && (
              <button
                onClick={() => onConfirm(record)}
                disabled={isConfirming}
                className="flex-1 px-4 py-3 bg-[#154212] text-white font-semibold rounded-xl hover:bg-[#0f300c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} />
                {isConfirming ? 'กำลังยืนยัน...' : 'บันทึก'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
