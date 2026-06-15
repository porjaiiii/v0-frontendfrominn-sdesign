'use client'

import { useState } from 'react'
import { Camera, Loader2, Minus, Plus } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useLiffContext } from '@/lib/liff-context'

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

  const clamp = (v: number) => Math.min(MAX_WEIGHT, Math.max(0, Math.round(v * 10) / 10))

  const adjustWeight = (amount: number) => {
    const newValue = clamp(value + amount)
    setWeightError(null)
    onChange(newValue)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseFloat(e.target.value)

    if (isNaN(raw) || raw < 0) {
      setWeightError('กรุณากรอกน้ำหนักที่มากกว่า 0')
      onChange(0)
      return
    }
    if (raw > MAX_WEIGHT) {
      setWeightError(`น้ำหนักต้องไม่เกิน ${MAX_WEIGHT} กก.`)
      onChange(MAX_WEIGHT)
      return
    }
    if (raw === 0) {
      setWeightError('น้ำหนักต้องมากกว่า 0')
      onChange(0)
      return
    }

    setWeightError(null)
    onChange(clamp(raw))
  }

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
            if (e.target.checked) onChange(0)
          }}
          className="w-5 h-5 rounded border-2 border-[#154212] text-[#154212] accent-[#154212]"
        />
        <span className="text-sm font-medium text-[#666666]">ไม่ทราบน้ำหนัก</span>
      </label>

      {/* Weight Input with +/- buttons */}
      <div className="flex items-center justify-center gap-4">
        {/* Minus button */}
        <button
          onClick={() => adjustWeight(-1.0)}
          disabled={noWeight || value <= 0}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0',
            noWeight
              ? 'bg-[#cccccc] cursor-not-allowed'
              : 'bg-[#154212] hover:bg-[#0d3308]'
          )}
        >
          <Minus className="w-6 h-6 text-white" />
        </button>

        {/* Number input */}
        <input
          type="number"
          value={value.toFixed(1)}
          onChange={handleInputChange}
          disabled={noWeight}
          className={cn(
            'w-40 text-center text-3xl font-semibold py-4 px-4 rounded-3xl border-2',
            'border-[#cccccc] focus:border-[#154212] focus:outline-none',
            'bg-white',
            noWeight && 'bg-[#f5f5f5] text-[#999999]'
          )}
          step="0.1"
          min="0.1"
          max={MAX_WEIGHT}
        />

        {/* Plus button */}
        <button
          onClick={() => adjustWeight(1.0)}
          disabled={noWeight || value >= MAX_WEIGHT}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0',
            noWeight
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
  imageUrl: string | null
  onImageChange: (url: string | null) => void
  referenceImage?: string
  referenceLabel?: string
  wasteType?: string
  weight?: number
}

export function ImageEvidence({ imageUrl, onImageChange, referenceImage, referenceLabel, wasteType, weight }: ImageEvidenceProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requirements, setRequirements] = useState({
    bagPreserved: false,
    evidenceVisible: false,
  })
  const { profile } = useLiffContext()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      setError(null)
      
      const reader = new FileReader()
      reader.onload = async (event) => {
        const base64String = event.target?.result as string
        console.log('[v0] Image selected, starting upload to Google Drive')
        
        try {
          const response = await fetch('/api/upload-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              base64Data: base64String.split(',')[1],
              fileName: `${profile?.userId || 'unknown'}_${wasteType || 'unknown'}_${weight || 0}_${Date.now()}.jpg`,
              userId: profile?.userId || 'unknown',
              wasteType: wasteType || '',
              weight: weight || 0,
              mimeType: 'image/jpeg'
            })
          })

          const result = await response.json()
          
          console.log('[v0] Full API response from upload:', JSON.stringify(result, null, 2))
          console.log('[v0] Has imageUrl?', !!result.imageUrl)
          
          if (result.success && result.imageUrl) {
            console.log('[v0] Image uploaded to Google Drive:', result.imageUrl)
            onImageChange(result.imageUrl)
          } else {
            const errorMsg = result.details || result.error || 'ไม่สามารถอัพโหลดรูปได้'
            console.error('[v0] Upload response error - no imageUrl:', {
              success: result.success,
              error: result.error,
              details: result.details,
              hasImageUrl: !!result.imageUrl,
              status: response.status,
              fullResponse: result
            })
            setError(errorMsg)
            const localUrl = URL.createObjectURL(file)
            onImageChange(localUrl)
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
          console.error('[v0] Upload request failed:', {
            error: errorMsg,
            type: err instanceof Error ? err.constructor.name : typeof err,
            fullError: err
          })
          setError(errorMsg)
          const localUrl = URL.createObjectURL(file)
          onImageChange(localUrl)
        }
      }
      
      reader.readAsDataURL(file)
    } catch (err) {
      console.error('[v0] File processing error:', err)
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRequirementChange = (key: keyof typeof requirements) => {
    setRequirements(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <h2 className="text-xl font-semibold text-[#154212]">แนบรูปถ่าย</h2>

      {/* Requirements info box */}
      <div className="bg-white rounded-2xl p-4 border border-[#e5e5e5]">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#e5e5e5]">
          <div className="relative w-5 h-5 shrink-0">
            <Image src="/icons/tabler-icon-bulb.png" alt="คำแนะนำ" fill className="object-contain" />
          </div>
          <span className="text-sm font-medium text-[#444444]">คำแนะนำในการแนบรูปถ่าย</span>
        </div>

        {/* Image + checkboxes side by side */}
        <div className="flex items-start gap-3">
          {/* Reference image */}
          {referenceImage && (
            <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden relative border border-[#e5e5e5] bg-[#f5f5f5]">
              <Image
                src={referenceImage}
                alt="ตัวอย่าง"
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Checkboxes for requirements */}
          <div className="flex-1 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requirements.bagPreserved}
                onChange={() => handleRequirementChange('bagPreserved')}
                className="w-5 h-5 rounded border-2 border-[#154212] accent-[#154212]"
              />
              <span className="text-sm text-[#444444]">เห็นถุงขยะ</span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requirements.evidenceVisible}
                onChange={() => handleRequirementChange('evidenceVisible')}
                className="w-5 h-5 rounded border-2 border-[#154212] accent-[#154212] mt-0.5 shrink-0"
              />
              <span className="text-sm text-[#444444] leading-snug">เห็นเลขน้ำหนักบนตราชั่ง ชัดเจน</span>
            </label>
          </div>
        </div>
      </div>

      {/* Photo upload area — square box aligned left */}
      <div className="flex items-start gap-4">
        <label className={cn(
          'w-36 h-36 shrink-0 rounded-2xl cursor-pointer overflow-hidden relative',
          'border-2 border-dashed transition-colors flex flex-col items-center justify-center',
          imageUrl
            ? 'border-[#154212]'
            : 'border-[#aaaaaa] bg-white hover:border-[#154212]',
          isUploading && 'opacity-75 cursor-wait'
        )}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
          {isUploading ? (
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#154212] mb-1" />
              <span className="text-xs font-medium text-[#666666]">กำลังอัพโหลด...</span>
            </div>
          ) : imageUrl ? (
            <Image
              src={imageUrl}
              alt="หลักฐาน"
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-[#666666] px-2">
              <Camera className="w-9 h-9 mb-2 text-[#888888]" />
              <span className="text-xs font-semibold text-[#333333] text-center">ถ่ายรูปขยะ</span>
              <span className="text-[10px] text-[#666666] mt-1 text-center leading-tight">
                (กรุณาถ่ายรูปขยะพร้อมตัวเลขน้ำหนัก)
              </span>
            </div>
          )}
        </label>

        {/* Helper text next to box */}
        {!imageUrl && !isUploading && (
          <p className="text-xs text-[#888888] leading-relaxed pt-1">
            กดที่กรอบเพื่อถ่ายรูปหรือเลือกรูปจากคลัง
          </p>
        )}
      </div>
      {error && (
        <span className="text-xs text-[#c06161] mt-2 font-medium block">{error}</span>
      )}
    </div>
  )
}
