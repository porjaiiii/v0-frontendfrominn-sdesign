'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, CheckCircle2, Camera, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WASTE_TYPES, WASTE_SUBTYPES } from '@/lib/waste-data'
import { compressImage } from '@/lib/compress-image'

// POINTS_PER_KG ต้องตรงกับ /api/waste/update/route.ts
const POINTS_PER_KG: Record<string, number> = {
  plastic: 6,
  paper: 4,
  glass: 4,
  aluminum: 25,
  oil: 3,
}

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

function recalculate(record: WasteRecord): WasteRecord {
  const rate = POINTS_PER_KG[record.waste_type] ?? 3
  const pointsEarned = Math.round(record.weight_kg * rate)
  const carbonReduction = record.weight_kg
  return { ...record, carbon_reduction: carbonReduction, points_earned: pointsEarned }
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

  // --- weight input state (รองรับ "0" ต้นและทศนิยม) ---
  const [weightDisplay, setWeightDisplay] = useState<string>('')
  const [isFocused, setIsFocused] = useState(false)

  // --- image upload state ---
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (record) {
      setEditedRecord(record)
      setWeightDisplay(record.weight_kg > 0 ? String(record.weight_kg) : '')
      setUploadError(null)
    }
  }, [record])

  // ฟังก์ชันอัปเดตค่าพร้อมคำนวณคะแนนใหม่ทุกครั้ง
  const updateField = (fields: Partial<WasteRecord>) => {
    setEditedRecord((prev) => {
      if (!prev) return prev
      const updated = { ...prev, ...fields }
      return recalculate(updated)
    })
  }

  // เมื่อเปลี่ยน waste_type ให้ reset subtype เป็นค่าแรกของประเภทใหม่
  const handleTypeChange = (newType: string) => {
    const subtypes = WASTE_SUBTYPES[newType as keyof typeof WASTE_SUBTYPES] ?? []
    const firstSubtype = subtypes[0]?.name ?? ''
    updateField({ waste_type: newType, waste_subtype: firstSubtype })
  }

  // --- weight input handlers: ป้องกันเลข 0 หาย ---
  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // อนุญาตเฉพาะตัวเลขและทศนิยมจุดเดียว
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
      setWeightDisplay(raw)
      if (raw === '' || raw === '.') {
        updateField({ weight_kg: 0 })
        return
      }
      const parsed = parseFloat(raw)
      if (!isNaN(parsed)) {
        updateField({ weight_kg: parsed })
      }
    }
  }

  const handleWeightBlur = () => {
    setIsFocused(false)
    if (weightDisplay === '' || weightDisplay === '.') {
      setWeightDisplay('')
      updateField({ weight_kg: 0 })
      return
    }
    const parsed = parseFloat(weightDisplay)
    if (!isNaN(parsed)) {
      setWeightDisplay(parsed > 0 ? String(parsed) : '')
      updateField({ weight_kg: parsed })
    }
  }

  const handleWeightFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    e.target.select()
  }

  const shownWeight = isFocused ? weightDisplay : (editedRecord && editedRecord.weight_kg > 0 ? String(editedRecord.weight_kg) : '')

  // --- image upload handler (copy pattern จาก ImageEvidence ใน weight-input.tsx) ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editedRecord) return

    try {
      setIsUploading(true)
      setUploadError(null)

      const { dataUrl: base64String } = await compressImage(file)

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: base64String.split(',')[1],
          fileName: `${editedRecord.user_id}_${editedRecord.waste_type}_${editedRecord.weight_kg}_${Date.now()}.jpg`,
          userId: editedRecord.user_id,
          wasteType: editedRecord.waste_type,
          weight: editedRecord.weight_kg,
          mimeType: 'image/jpeg',
        }),
      })

      const result = await response.json()

      if (result.success && result.imageUrl) {
        updateField({ image_url: result.imageUrl })
      } else {
        // fallback: ใช้ local object URL แสดงก่อน
        const localUrl = URL.createObjectURL(file)
        updateField({ image_url: localUrl })
        setUploadError(result.details || result.error || 'อัปโหลดไม่สำเร็จ (ใช้รูป local แทน)')
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอัปโหลด')
    } finally {
      setIsUploading(false)
      // reset input เพื่อให้เลือกไฟล์เดิมซ้ำได้
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleConfirmClick = async () => {
    if (!editedRecord) return

    try {
      setIsSavingApi(true)

      if (isEditing) {
        const response = await fetch('/api/waste/update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editedRecord),
        })

        if (!response.ok) {
          const error = await response.json()
          alert('เกิดข้อผิดพลาดในการบันทึก: ' + (error.error || 'Unknown error'))
          return
        }
      }

      await onConfirm(editedRecord)
      onClose()
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsSavingApi(false)
    }
  }

  if (!isOpen || !record || !editedRecord) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="w-full bg-white rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
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

        <div className="space-y-5">
          {/* Image section */}
          {isEditing ? (
            /* Edit mode: แสดงรูปปัจจุบัน + ปุ่มเปลี่ยนรูป */
            <div className="space-y-2">
              <p className="text-xs text-[#666666] font-medium">รูปประกอบ</p>
              <div className="relative rounded-xl overflow-hidden h-40 bg-gray-100 border-2 border-dashed border-[#aaaaaa] flex items-center justify-center">
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-[#154212]" />
                    <span className="text-xs text-[#666666]">กำลังอัปโหลด...</span>
                  </div>
                ) : editedRecord.image_url ? (
                  <>
                    <Image
                      src={editedRecord.image_url}
                      alt="รูปขยะ"
                      fill
                      className="object-cover"
                    />
                    {/* ปุ่มเปลี่ยนรูป */}
                    <label className="absolute bottom-2 right-2 bg-[#154212] text-white rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer flex items-center gap-1.5 hover:bg-[#0f300c] transition-colors shadow-md">
                      <Camera size={13} />
                      เปลี่ยนรูป
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        disabled={isUploading}
                        className="hidden"
                      />
                    </label>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 cursor-pointer w-full h-full">
                    <Camera size={36} className="text-[#888888]" />
                    <span className="text-xs text-[#666666] font-semibold">กดเพื่อแนบรูป</span>
                    <span className="text-[10px] text-[#999999]">(กรุณาถ่ายรูปพร้อมเลขน้ำหนัก)</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              {uploadError && (
                <p className="text-xs text-[#c06161] font-medium">{uploadError}</p>
              )}
            </div>
          ) : (
            /* View mode: แสดงรูปอย่างเดียว */
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
                      placeholder.innerHTML =
                        '<svg class="w-16 h-16 text-[#999999]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg><span class="text-[#666666] font-semibold text-sm">รูปไม่พบ</span>'
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
          )}

          {/* Type - Dropdown */}
          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">ประเภทขยะ</p>
            {isEditing ? (
              <select
                value={editedRecord.waste_type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold bg-white appearance-none"
              >
                {WASTE_TYPES.map((wt) => (
                  <option key={wt.id} value={wt.id}>
                    {wt.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold bg-white">
                {WASTE_TYPES.find((wt) => wt.id === editedRecord.waste_type)?.name ?? editedRecord.waste_type}
              </div>
            )}
          </div>

          {/* Subtype - Dropdown */}
          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">ประเภทย่อย</p>
            {isEditing ? (
              <select
                value={editedRecord.waste_subtype}
                onChange={(e) => updateField({ waste_subtype: e.target.value })}
                className="w-full border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold bg-white appearance-none"
              >
                {(WASTE_SUBTYPES[editedRecord.waste_type as keyof typeof WASTE_SUBTYPES] ?? []).map((sub) => (
                  <option key={sub.id} value={sub.name}>
                    {sub.name.replace(/\n/g, ' ')}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold bg-white">
                {editedRecord.waste_subtype}
              </div>
            )}
          </div>

          {/* Weight - ใช้ type="text" + inputMode="decimal" เพื่อป้องกันเลข 0 หาย */}
          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">ระบุน้ำหนัก (กก.)</p>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              value={shownWeight}
              onChange={handleWeightChange}
              onFocus={handleWeightFocus}
              onBlur={handleWeightBlur}
              disabled={!isEditing}
              placeholder="0.0"
              className={cn(
                'w-full bg-white border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold text-lg',
                isEditing ? 'cursor-text' : 'cursor-default bg-gray-100'
              )}
            />
          </div>

          {/* Timestamp - Read Only */}
          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">เวลา</p>
            <div className="w-full bg-gray-100 border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold cursor-default">
              {new Date(editedRecord.timestamp).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}{' '}
              {new Date(editedRecord.timestamp).toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              น.
            </div>
          </div>

          {/* Points - คำนวณอัตโนมัติจาก weight × carbon factor × 10 */}
          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">
              แต้มที่ได้รับ{isEditing ? ' (คำนวณอัตโนมัติจากน้ำหนัก)' : ' (คำนวณอัตโนมัติ)'}
            </p>
            <div className="w-full bg-gray-100 border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold text-lg cursor-default">
              {editedRecord.points_earned} แต้ม
              {isEditing && editedRecord.weight_kg > 0 && (
                <span className="text-xs text-[#888888] font-normal ml-2">
                  ({editedRecord.weight_kg} กก. × {POINTS_PER_KG[editedRecord.waste_type] ?? 3} แต้ม/กก.)
                </span>
              )}
            </div>
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
              ย้อนกลับ
            </button>
            {isEditing ? (
              <button
                onClick={handleConfirmClick}
                disabled={isSavingApi || isConfirming || isUploading}
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
