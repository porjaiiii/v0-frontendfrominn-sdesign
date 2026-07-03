'use client'

import { useState } from 'react'
import { Camera, Loader2, Minus, Plus, X } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useLiffContext } from '@/lib/liff-context'
import { compressImage } from '@/lib/compress-image'

interface WeightInputProps {
  value: number
  onChange: (value: number) => void
  noWeight?: boolean
  onNoWeightChange?: (noWeight: boolean) => void
  unit?: string
}

const MAX_WEIGHT = 100

export function WeightInput({ value, onChange, noWeight = false, onNoWeightChange, unit = 'กก.' }: WeightInputProps) {
  const [weightError, setWeightError] = useState<string | null>(null)
  // displayValue holds the raw string while user is typing (allows "1.", "1.5", etc.)
  const [displayValue, setDisplayValue] = useState<string>(value > 0 ? String(value) : '')
  const [isFocused, setIsFocused] = useState(false)

  const clamp = (v: number) => Math.min(MAX_WEIGHT, Math.max(0, Math.round(v * 10) / 10))

  const adjustWeight = (amount: number) => {
    const newValue = clamp(value + amount)
    setWeightError(null)
    onChange(newValue)
    setDisplayValue(newValue > 0 ? String(newValue) : '')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // Allow empty, digits, and a single decimal point
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
      setDisplayValue(raw)
      setWeightError(null)

      if (raw === '' || raw === '.') {
        onChange(0)
        return
      }

      const parsed = parseFloat(raw)
      if (isNaN(parsed)) return

      if (parsed > MAX_WEIGHT) {
        setWeightError(`น้ำหนักต้องไม่เกิน ${MAX_WEIGHT} กก.`)
        onChange(MAX_WEIGHT)
        return
      }

      onChange(clamp(parsed))
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    // On blur, normalize the display value
    if (displayValue === '' || displayValue === '.') {
      setDisplayValue('')
      onChange(0)
      return
    }
    const parsed = parseFloat(displayValue)
    if (!isNaN(parsed)) {
      const clamped = clamp(parsed)
      setDisplayValue(clamped > 0 ? String(clamped) : '')
      onChange(clamped)
      if (parsed === 0) {
        setWeightError('น้ำหนักต้องมากกว่า 0')
      }
    }
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    // Select all text so user can start typing immediately
    e.target.select()
  }

  // Sync displayValue when value is changed externally (e.g. +/- buttons) and not focused
  const shownValue = isFocused ? displayValue : (value > 0 ? String(value) : '')

  return (
    <div className="space-y-6">
      {/* Title */}
      <h2 className="text-xl font-semibold text-[#154212]">
        ระบุน้ำหนัก ({unit})
      </h2>

      {/* Checkbox for unknown weight */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={noWeight}
          onChange={(e) => {
            onNoWeightChange?.(e.target.checked)
            if (e.target.checked) {
              onChange(0)
              setDisplayValue('')
              setWeightError(null)
            }
          }}
          className="w-5 h-5 rounded border-2 border-[#154212] text-[#154212] accent-[#154212]"
        />
        <span className="text-sm font-medium text-[#666666]">ไม่ทราบน้ำหนัก</span>
      </label>

      {/* Weight Input with +/- buttons */}
      <div className="flex items-center justify-center gap-4">
        {/* Minus button */}
        <button
          type="button"
          onClick={() => adjustWeight(-1.0)}
          disabled={noWeight || value <= 0}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0',
            noWeight || value <= 0
              ? 'bg-[#cccccc] cursor-not-allowed'
              : 'bg-[#154212] hover:bg-[#0d3308]'
          )}
        >
          <Minus className="w-6 h-6 text-white" />
        </button>

        {/* Text input — uses inputMode="decimal" for mobile numeric keyboard with decimal */}
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          value={shownValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={noWeight}
          placeholder="0.0"
          className={cn(
            'w-40 text-center text-3xl font-semibold py-4 px-4 rounded-3xl border-2',
            'focus:border-[#154212] focus:outline-none',
            'bg-white',
            noWeight && 'bg-[#f5f5f5] text-[#999999]'
          )}
        />

        {/* Plus button */}
        <button
          type="button"
          onClick={() => adjustWeight(1.0)}
          disabled={noWeight || value >= MAX_WEIGHT}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0',
            noWeight || value >= MAX_WEIGHT
              ? 'bg-[#cccccc] cursor-not-allowed'
              : 'bg-[#154212] hover:bg-[#0d3308]'
          )}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Validation error */}
      {weightError && (
        <p className="text-sm text-red-500 text-center font-medium">{weightError}</p>
      )}
    </div>
  )
}

interface ImageEvidenceProps {
  imageUrls: string[] // เปลี่ยนเป็น Array
  onImagesChange: (urls: string[]) => void // เปลี่ยนเป็นรับ Array
  referenceImage?: string
  referenceLabel?: string
  wasteType?: string
  weight?: number
}

export function ImageEvidence({ imageUrls = [], onImagesChange, referenceImage, referenceLabel, wasteType, weight }: ImageEvidenceProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { profile } = useLiffContext()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      setError(null)

      const { dataUrl: base64String } = await compressImage(file)

      try {
        const response = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data: base64String.split(',')[1],
            fileName: `${profile?.userId || 'unknown'}_${wasteType || 'unknown'}_${weight || 0}_${Date.now()}.jpg`,
            userId: profile?.userId || 'unknown'
          })
        })

        const result = await response.json()
        
        if (result.success && result.imageUrl) {
          // เพิ่มรูปใหม่เข้าไปใน Array เดิม
          onImagesChange([...imageUrls, result.imageUrl])
        } else {
          const errorMsg = result.error || 'ไม่สามารถอัพโหลดรูปได้'
          setError(errorMsg)
        }
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการอัปโหลด')
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการบีบอัดรูป')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[#154212]">แนบรูปถ่าย</h2>

      {/* ส่วนคำแนะนำ (คงเดิม) */}
      <div className="bg-white rounded-2xl p-4 border border-[#e5e5e5]">
        <div className="flex items-center justify-center gap-2 mb-3 pb-3 border-b border-[#e5e5e5]">
          <span className="text-sm font-medium text-[#444444]">คำแนะนำในการแนบรูปถ่าย</span>
        </div>
        <div className="flex items-start gap-3">
          {referenceImage && (
            <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden relative border bg-[#f5f5f5]">
              <Image src={referenceImage} alt="ตัวอย่าง" fill className="object-cover" />
            </div>
          )}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <img src="/icons/light bulb.svg" alt="" className="w-5 h-5 shrink-0" />
              <span className="text-sm text-[#444444]">เห็นถุงขยะ</span>
            </div>
            <div className="flex items-start gap-3">
              <img src="/icons/light bulb.svg" alt="" className="w-5 h-5 mt-0.5 shrink-0" />
              <span className="text-sm text-[#444444]">เห็นเลขน้ำหนักชัดเจน</span>
            </div>
          </div>
        </div>
      </div>

      {/* ส่วนแสดงรูปถ่ายแบบ Grid */}
      <div className="flex flex-wrap gap-4">
        {/* วนลูปแสดงรูปที่มีทั้งหมด */}
        {imageUrls.map((url, index) => (
          <div key={index} className="w-36 h-36 shrink-0 rounded-2xl overflow-hidden relative border-2 border-[#154212]">
            <Image src={url} alt="หลักฐาน" fill className="object-cover" />
            <button
              type="button"
              onClick={() => onImagesChange(imageUrls.filter((_, i) => i !== index))}
              className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        ))}

        {/* ปุ่มเพิ่มรูป (ถ้าอัปโหลดอยู่แสดง Loading) */}
        <label className={cn(
          "w-36 h-36 shrink-0 rounded-2xl cursor-pointer overflow-hidden relative border-2 border-dashed flex flex-col items-center justify-center transition-colors",
          isUploading ? "border-gray-300 bg-gray-50" : "border-[#aaaaaa] hover:border-[#154212]"
        )}>
          {isUploading ? (
            <Loader2 className="w-8 h-8 animate-spin text-[#154212]" />
          ) : (
            <>
              <Camera className="w-9 h-9 mb-2 text-[#888888]" />
              <span className="text-xs font-semibold text-center">ถ่ายรูปเพิ่ม</span>
              <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} disabled={isUploading} className="hidden" />
            </>
          )}
        </label>
      </div>
      
      {error && <span className="text-xs text-[#c06161] font-medium block">{error}</span>}
    </div>
  )
}