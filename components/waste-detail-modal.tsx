'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, CheckCircle2 } from 'lucide-react'
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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">รายละเอียดขยะ</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Image */}
          {record.image_url && (
            <div className="rounded-xl overflow-hidden h-48 bg-gray-100 flex items-center justify-center">
              <Image
                src={record.image_url}
                alt={`${record.waste_type} - ${record.waste_subtype}`}
                width={400}
                height={300}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.target as HTMLImageElement
                  img.style.display = 'none'
                }}
              />
            </div>
          )}

          {/* Type Info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-sm text-gray-600 mb-1">ประเภทขยะ</p>
              <p className="font-semibold text-gray-800">{record.waste_type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">ประเภทย่อย</p>
              <p className="font-semibold text-gray-800">{record.waste_subtype}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-600 mb-1">น้ำหนัก</p>
              <p className="text-2xl font-bold text-blue-800">{record.weight_kg}</p>
              <p className="text-xs text-blue-600 mt-1">kg</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-xs text-green-600 mb-1">คาร์บอนลดลง</p>
              <p className="text-2xl font-bold text-green-800">
                {(record.carbon_reduction ?? 0).toFixed(1)}
              </p>
              <p className="text-xs text-green-600 mt-1">kg CO2</p>
            </div>
          </div>

          {/* Points & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-yellow-50 rounded-xl p-4">
              <p className="text-xs text-yellow-600 mb-1">คะแนน</p>
              <p className="text-2xl font-bold text-yellow-800">+{record.points_earned}</p>
            </div>
            <div className="bg-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-1">สถานะ</p>
              <p className="text-sm font-semibold text-gray-800 capitalize">
                {record.status}
              </p>
            </div>
          </div>

          {/* Timestamp */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600 mb-2">วันเวลาบันทึก</p>
            <p className="font-semibold text-gray-800">
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
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-800 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              ปิด
            </button>
            {record.status === 'pending' && (
              <button
                onClick={() => onConfirm(record)}
                disabled={isConfirming}
                className="flex-1 px-4 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} />
                {isConfirming ? 'กำลังยืนยัน...' : 'ยืนยันข้อมูล'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
