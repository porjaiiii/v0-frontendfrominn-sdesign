'use client'

import { useState, useEffect } from 'react'
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
  onConfirm: (record: WasteRecord) => void | Promise<void>
  isConfirming?: boolean
  isEditing?: boolean
}

export function WasteDetailModal({
  record,
  isOpen,
  onClose,
  onConfirm,
  isConfirming = false,
  isEditing = false,
}: WasteDetailModalProps) {
  const [editedRecord, setEditedRecord] = useState<WasteRecord | null>(null)
  const [isSavingApi, setIsSavingApi] = useState(false)

  useEffect(() => {
    if (record) {
      setEditedRecord(record)
    }
  }, [record])

  const handleConfirmClick = async () => {
    if (!editedRecord) return

    try {
      setIsSavingApi(true)
      console.log('[v0] Modal confirm clicked, isEditing:', isEditing)
      
      if (isEditing) {
        // Call API to update the record
        console.log('[v0] Updating record via API:', editedRecord)
        const response = await fetch('/api/waste/update', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editedRecord),
        })

        if (!response.ok) {
          const error = await response.json()
          console.error('[v0] API error:', error)
          alert('เกิดข้อผิดพลาดในการบันทึก: ' + (error.error || 'Unknown error'))
          return
        }

        const result = await response.json()
        console.log('[v0] API response:', result)
      }

      // Call the parent handler
      await onConfirm(editedRecord)
      onClose()
    } catch (error) {
      console.error('[v0] Error in handleConfirmClick:', error)
      alert('เกิดข้อผิดพลาด: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsSavingApi(false)
    }
  }

  if (!isOpen || !record || !editedRecord) return null

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

          {/* Type Info - Editable */}
          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">ประเภทขยะ</p>
            <input
              type="text"
              value={editedRecord.waste_type}
              onChange={(e) =>
                setEditedRecord({ ...editedRecord, waste_type: e.target.value })
              }
              disabled={!isEditing}
              className={cn(
                'w-full border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold',
                isEditing ? 'bg-white cursor-text' : 'bg-white cursor-default'
              )}
            />
          </div>

          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">ประเภทย่อย</p>
            <input
              type="text"
              value={editedRecord.waste_subtype}
              onChange={(e) =>
                setEditedRecord({ ...editedRecord, waste_subtype: e.target.value })
              }
              disabled={!isEditing}
              className={cn(
                'w-full border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold',
                isEditing ? 'bg-white cursor-text' : 'bg-white cursor-default'
              )}
            />
          </div>

          {/* Weight - Full Width */}
          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">ระบุน้ำหนัก (กก.)</p>
            <div className="flex items-end gap-2">
              <input
                type="number"
                step="0.1"
                value={editedRecord.weight_kg}
                onChange={(e) =>
                  setEditedRecord({ ...editedRecord, weight_kg: parseFloat(e.target.value) || 0 })
                }
                disabled={!isEditing}
                className={cn(
                  'flex-1 bg-white border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold text-lg',
                  isEditing ? 'cursor-text' : 'cursor-default'
                )}
              />
            </div>
          </div>

          {/* Timestamp - Read Only */}
          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">เวลา</p>
            <div className="w-full bg-gray-100 border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold cursor-default">
              {new Date(editedRecord.timestamp).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })} {new Date(editedRecord.timestamp).toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
              })} น.
            </div>
          </div>

          {/* Points - Now Editable */}
          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">แต้มที่ได้รับ</p>
            <input
              type="number"
              step="1"
              value={editedRecord.points_earned}
              onChange={(e) =>
                setEditedRecord({ ...editedRecord, points_earned: parseInt(e.target.value) || 0 })
              }
              disabled={!isEditing}
              className={cn(
                'w-full bg-white border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold text-lg',
                isEditing ? 'cursor-text' : 'cursor-default'
              )}
            />
          </div>

          {/* Carbon Reduction - Read Only */}
          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">หมายเหตุ</p>
            <div className="w-full bg-gray-100 border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold cursor-default">
              {(editedRecord.carbon_reduction ?? 0).toFixed(2)} kg CO2
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
            {isEditing ? (
              <button
                onClick={handleConfirmClick}
                disabled={isSavingApi || isConfirming}
                className="flex-1 px-4 py-3 bg-[#154212] text-white font-semibold rounded-full hover:bg-[#0f300c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} />
                {isSavingApi || isConfirming ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            ) : (
              record.status === 'pending' && (
                <button
                  onClick={handleConfirmClick}
                  disabled={isSavingApi || isConfirming}
                  className="flex-1 px-4 py-3 bg-[#154212] text-white font-semibold rounded-full hover:bg-[#0f300c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} />
                  {isSavingApi || isConfirming ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
