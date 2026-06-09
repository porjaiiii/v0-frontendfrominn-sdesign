'use client'

import { useState } from 'react'
import { Camera, Loader2, Minus, Plus } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useLiffContext } from '@/lib/liff-context'

interface WeightInputProps {
  value: number
  onChange: (value: number) => void
  unit?: string
}

export function WeightInput({ value, onChange, unit = 'กก.' }: WeightInputProps) {
  const [noWeight, setNoWeight] = useState(false)

  const adjustWeight = (amount: number) => {
    const newValue = Math.max(0, Math.round((value + amount) * 10) / 10)
    onChange(newValue)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value) || 0
    onChange(Math.max(0, newValue))
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
            setNoWeight(e.target.checked)
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
          disabled={noWeight}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all',
            'bg-[#999999] hover:bg-[#888888] disabled:bg-[#cccccc] disabled:cursor-not-allowed'
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
            'w-48 text-center text-4xl font-semibold py-4 px-6 rounded-3xl border-2',
            'border-[#cccccc] focus:border-[#154212] focus:outline-none',
            'bg-white',
            noWeight && 'bg-[#f5f5f5] text-[#999999]'
          )}
          step="0.1"
          min="0"
        />

        {/* Plus button */}
        <button
          onClick={() => adjustWeight(1.0)}
          disabled={noWeight}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all',
            'bg-[#999999] hover:bg-[#888888] disabled:bg-[#cccccc] disabled:cursor-not-allowed'
          )}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>
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
      <h2 className="text-xl font-semibold text-[#154212]">แบบรูปถ่าย</h2>

      {/* Requirements info box */}
      <div className="bg-[#f5f5f5] rounded-2xl p-4 space-y-3 border border-[#e5e5e5]">
        <div className="flex items-start gap-3">
          <div className="text-xl">☀️</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#154212] mb-3">
              คำแนะนำในการถ่ายรูปแบบรูปถ่าย
            </p>
            
            {/* Reference image */}
            {referenceImage && (
              <div className="mb-3">
                <div className="w-full aspect-square bg-white rounded-xl overflow-hidden relative border border-[#e5e5e5]">
                  <Image
                    src={referenceImage}
                    alt="ตัวอย่าง"
                    fill
                    className="object-contain p-2"
                  />
                </div>
              </div>
            )}

            {/* Checkboxes for requirements */}
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requirements.bagPreserved}
                  onChange={() => handleRequirementChange('bagPreserved')}
                  className="w-5 h-5 rounded border-2 border-[#154212] text-[#154212] accent-[#154212]"
                />
                <span className="text-sm text-[#444444]">เก็บถุงขยะ</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requirements.evidenceVisible}
                  onChange={() => handleRequirementChange('evidenceVisible')}
                  className="w-5 h-5 rounded border-2 border-[#154212] text-[#154212] accent-[#154212]"
                />
                <span className="text-sm text-[#444444]">เติมเลขบันหลักฐานชั้นอย่างชัดเจน ชัดเจน</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Photo upload area */}
      <div>
        <label className={cn(
          'w-full aspect-square rounded-2xl overflow-hidden relative cursor-pointer',
          'border-2 border-dashed transition-colors flex flex-col items-center justify-center',
          imageUrl 
            ? 'border-[#154212] bg-[#f0fdf0]' 
            : 'border-[#cccccc] bg-[#f5f5f5] hover:border-[#154212]',
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
              <Loader2 className="w-8 h-8 animate-spin text-[#154212] mb-2" />
              <span className="text-xs font-medium text-[#666666]">กำลังอัพโหลด...</span>
            </div>
          ) : imageUrl ? (
            <Image
              src={imageUrl}
              alt="หลักฐาน"
              fill
              className="object-cover"
              onError={(e) => {
                console.log('[v0] Image display error, may be Google Drive URL')
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-[#999999]">
              <Camera className="w-12 h-12 mb-2" />
              <span className="text-sm font-medium">ถ่ายรูป</span>
              <span className="text-xs text-[#666666] mt-1">
                (กรุณาถ่ายรูปให้ชัดเจน)
              </span>
            </div>
          )}
        </label>
        {error && (
          <span className="text-xs text-[#c06161] mt-2 font-medium block text-center">{error}</span>
        )}
      </div>
    </div>
  )
}
