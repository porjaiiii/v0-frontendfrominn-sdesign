'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, CheckCircle2, Camera, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WASTE_TYPES, WASTE_SUBTYPES } from '@/lib/waste-data'
import { apiFetch, displaySrc, uploadWastePhoto, useIdempotencyKey } from '@/lib/api-client'
import { useApp } from '@/lib/app-context'
import { compressImage } from '@/lib/compress-image'
import { carbonFactorFor, pointsPerKgFor, type WasteRate, WASTE_RATES } from '@/lib/rates'

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

interface WasteDetailModalProps {
  record: WasteRecord | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (record: WasteRecord) => void | Promise<void>
  isConfirming?: boolean
  isEditing?: boolean
}

function recalculate(
  record: WasteRecord,
  rates: Record<string, WasteRate> = WASTE_RATES,
): WasteRecord {
  const carbonReduction = record.weight_kg * carbonFactorFor(record.waste_type, rates)
  const pointsEarned = Math.round(record.weight_kg * pointsPerKgFor(record.waste_type, rates))
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
  // Photos whose upload failed. Shown to the user, never sent to the server —
  // see handleFileChange.
  const [localPreviews, setLocalPreviews] = useState<string[]>([])
  const confirmKey = useIdempotencyKey()

  // --- weight input state (รองรับ "0" ต้นและทศนิยม) ---
  const [weightDisplay, setWeightDisplay] = useState<string>('')
  const [isFocused, setIsFocused] = useState(false)
  const [weightError, setWeightError] = useState<string | null>(null)

  // --- image upload state ---
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (record) {
      setEditedRecord(record)
      setWeightDisplay(record.weight_kg > 0 ? String(record.weight_kg) : '')
      setUploadError(null)
      setWeightError(null)
    }
  }, [record])

  // ฟังก์ชันอัปเดตค่าพร้อมคำนวณคะแนนใหม่ทุกครั้ง
  const { wasteRates } = useApp()

  const updateField = (fields: Partial<WasteRecord>) => {
    setEditedRecord((prev) => {
      if (!prev) return prev
      const updated = { ...prev, ...fields }
      return recalculate(updated, wasteRates)
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
      setWeightError(null)
      if (raw === '' || raw === '.') {
        updateField({ weight_kg: 0 })
        return
      }
      const parsed = parseFloat(raw)
      if (!isNaN(parsed)) {
        if (parsed > 100) {
          setWeightError('น้ำหนักต้องไม่เกิน 100 กก.')
          return
        }
        updateField({ weight_kg: parsed })
      }
    }
  }

  const handleWeightBlur = () => {
    setIsFocused(false)
    setWeightError(null)
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

    // The Blob, not the data URL — it goes straight to storage now.
    const { blob } = await compressImage(file)
    const currentUrls = editedRecord.image_urls || []

    let stored: string | null = null
    try {
      stored = await uploadWastePhoto(blob, {
        fileName: `${editedRecord.user_id}_${editedRecord.waste_type}_${editedRecord.weight_kg}_${Date.now()}.jpg`,
        userId: editedRecord.user_id,
      })
    } catch (uploadErr) {
      console.error('[waste-detail-modal] upload failed:', uploadErr)
    }

    if (stored) {
      updateField({ image_urls: [...currentUrls, stored] })
    } else {
      // A failed upload used to push URL.createObjectURL(file) into image_urls,
      // which then got SAVED. A blob: URL is alive only in the tab that made it,
      // so what reached the sheet was a permanently broken link posing as
      // evidence — and the server now rejects it outright (a CHECK constraint
      // plus the zod schema), which would fail the whole submit with a 400.
      //
      // Keep it as a local preview instead: the user still sees their photo and
      // a clear error, nothing unsaveable enters the record, and the save button
      // stays disabled until a real upload lands.
      setLocalPreviews((prev) => [...prev, URL.createObjectURL(file)])
      setUploadError('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่')
    }
  } catch (err) {
    setUploadError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอัปโหลด')
  } finally {
    setIsUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
}

const handleConfirmClick = async () => {
  if (!editedRecord) return

  try {
    setIsSavingApi(true)

    // 🌟 จัดเตรียม Payload ให้ตรงกับที่ API / Sheet ต้องการ
    const payload = {
      ...editedRecord,
      // แปลงจาก array กลับเป็น string คั่นด้วยลูกน้ำ (หรือเอาแค่รูปแรกก็ได้ตามต้องการ)
      image_url: editedRecord.image_urls && editedRecord.image_urls.length > 0 
        ? editedRecord.image_urls.join(',') 
        : null
    }

    if (isEditing) {
      const response = await apiFetch('/api/waste/update', {
        method: 'PUT',
        idempotencyKey: confirmKey.current(),
        body: JSON.stringify(payload), // 👈 ส่ง payload ตัวที่ปรับชื่อ key แล้ว
      })

      if (!response.ok) {
        const error = await response.json()
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + (error.error || 'Unknown error'))
        return
      }

      confirmKey.reset()
    }

    // อาจจะต้องปรับ type ของ onConfirm ถ้ารับค่าต่างกัน
    await onConfirm(editedRecord)
    onClose()
  } catch (error) {
    alert('เกิดข้อผิดพลาด: ' + (error instanceof Error ? error.message : 'Unknown error'))
  } finally {
    setIsSavingApi(false)
  }
}

  // Object URLs hold the file in memory until revoked.
  useEffect(() => {
    if (isOpen) return
    setLocalPreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url))
      return []
    })
  }, [isOpen])

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
  
  <div className="grid grid-cols-2 gap-2">
    {/* แสดงรูปที่มีอยู่แล้ว */}
    {editedRecord.image_urls?.map((url, i) => (
      <div key={i} className="relative rounded-xl overflow-hidden h-32 border border-[#aaaaaa]">
        <Image src={displaySrc(url)} alt="รูปขยะ" fill className="object-cover" />
        {/* ปุ่มลบรูป (ถ้าต้องการ) */}
        <button 
          onClick={() => { /* ฟังก์ชันลบรูปจาก Array */ }}
          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
        >
          ×
        </button>
      </div>
    ))}

    {/* รูปที่อัปโหลดไม่สำเร็จ — แสดงให้เห็นแต่ไม่ถูกบันทึก */}
    {localPreviews.map((url, i) => (
      <div key={`local-${i}`} className="relative rounded-xl overflow-hidden h-32 border border-red-300">
        <Image src={url} alt="รูปที่ยังไม่ได้อัปโหลด" fill className="object-cover opacity-60" />
        <div className="absolute inset-x-0 bottom-0 bg-red-500/90 text-white text-[10px] text-center py-1">
          ยังไม่ได้อัปโหลด
        </div>
      </div>
    ))}

    {/* ปุ่มกดเพิ่มรูปใหม่ (ปุ่มนี้จะโชว์เสมอเพื่อเพิ่มรูปเข้าไปใน Array) */}
    <label className="h-32 flex flex-col items-center justify-center gap-1 cursor-pointer border-2 border-dashed border-[#aaaaaa] rounded-xl bg-gray-50 hover:bg-gray-100">
      <Camera size={24} className="text-[#888888]" />
      <span className="text-[10px] text-[#666666]">เพิ่มรูป</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange} // ฟังก์ชันนี้ต้องปรับให้ push รูปใหม่เข้า array
        className="hidden"
      />
    </label>
  </div>
  
  {isUploading && <p className="text-xs text-[#154212]">กำลังอัปโหลด...</p>}
</div>
          ) : (
            /* View mode: แสดงรูปอย่างเดียว */
            <div className="grid grid-cols-2 gap-2">
  {record.image_urls && record.image_urls.length > 0 ? (
    record.image_urls.map((url, i) => (
      <div key={i} className="relative rounded-xl overflow-hidden h-32 bg-gray-100 border border-[#d4d4d4]">
        <Image
          src={displaySrc(url)}
          alt={`รูปขยะที่ ${i + 1}`}
          fill
          className="object-cover"
        />
      </div>
    ))
  ) : (
    <div className="col-span-2 h-32 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl text-gray-400">
      ไม่มีรูปภาพ
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
                'w-full bg-white border-2 rounded-lg px-4 py-3 text-[#154212] font-semibold text-lg',
                weightError ? 'border-red-500' : 'border-[#d4d4d4]',
                isEditing ? 'cursor-text' : 'cursor-default bg-gray-100'
              )}
            />
            {weightError && (
              <p className="text-xs text-red-500 font-medium mt-2">{weightError}</p>
            )}
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
                  ({editedRecord.weight_kg} กก. × {pointsPerKgFor(editedRecord.waste_type, wasteRates)} แต้ม/กก.)
                </span>
              )}
            </div>
          </div>

          {/* Carbon Reduction - Read Only */}
          <div>
            <p className="text-xs text-[#666666] font-medium mb-2">หมายเหตุ</p>
            <div className="w-full bg-gray-100 border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold cursor-default">
              {(editedRecord.carbon_reduction ?? 0).toFixed(4)} kg CO2
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
    disabled={
      isSavingApi || 
      isConfirming || 
      isUploading || 
      !editedRecord?.image_urls?.length
    }
    className={`flex-1 px-4 py-3 font-semibold rounded-full transition-colors flex items-center justify-center gap-2 ${
      isSavingApi || isConfirming || isUploading || !editedRecord?.image_urls?.length
        ? 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
        : 'bg-[#154212] text-white hover:bg-[#0f300c]'
    }`}
  >
    <CheckCircle2 size={20} />
    {isSavingApi || isConfirming ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
  </button>
) : (
  record?.status === 'pending' && (
    <button
      onClick={handleConfirmClick}
      disabled={
        isSavingApi || 
        isConfirming || 
        !record?.image_urls?.length
      }
      className={`flex-1 px-4 py-3 font-semibold rounded-full transition-colors flex items-center justify-center gap-2 ${
        isSavingApi || isConfirming || !record?.image_urls?.length
          ? 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
          : 'bg-[#154212] text-white hover:bg-[#0f300c]'
      }`}
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
