'use client'

import { useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-base font-semibold text-[#154212]">
          ระบุน้ำหนัก ({unit})
        </label>
        <label className="flex items-center gap-2 text-sm text-[#666666]">
          <input
            type="checkbox"
            checked={noWeight}
            onChange={(e) => {
              setNoWeight(e.target.checked)
              if (e.target.checked) onChange(0)
            }}
            className="rounded border-[#e5e5e5] text-[#154212] focus:ring-[#154212]"
          />
          ไม่ทราบน้ำหนัก
        </label>
      </div>

      <div className="flex items-center justify-center">
        <input
          type="number"
          value={value.toFixed(1)}
          onChange={handleInputChange}
          disabled={noWeight}
          className={cn(
            'w-40 text-center text-3xl font-semibold py-4 px-6 rounded-xl border-2',
            'border-[#e5e5e5] focus:border-[#154212] focus:outline-none',
            noWeight && 'bg-[#f5f5f5] text-[#999999]'
          )}
          step="0.1"
          min="0"
        />
      </div>

      <div className="flex justify-center gap-2">
        {[-1.0, -0.5, 0.5, 1.0].map((amount) => (
          <button
            key={amount}
            onClick={() => adjustWeight(amount)}
            disabled={noWeight}
            className={cn(
              'w-12 h-10 rounded-lg text-sm font-semibold transition-colors border',
              amount < 0 
                ? 'bg-[#c06161] text-white border-[#c06161] hover:bg-[#b05555]'
                : 'bg-[#6fc061] text-white border-[#6fc061] hover:bg-[#5fb052]',
              noWeight && 'opacity-50 cursor-not-allowed'
            )}
          >
            {amount > 0 ? `+${amount}` : amount}
          </button>
        ))}
      </div>

      {/* Recommendation Box */}
      <div className="bg-[#f5f5f5] rounded-xl p-4">
        <p className="text-sm font-semibold text-[#154212] mb-2">แนะนำลำดับ</p>
        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#e5e5e5]">
          <div className="w-12 h-12 rounded-lg bg-[#b6ebad] flex items-center justify-center">
            <span className="text-2xl">♻️</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[#444444]">ตัวอย่างการชั่ง</p>
            <p className="text-xs text-[#666666]">เพิ่มน้ำหนักด้วยการกดปุ่มหรือพิมพ์ตัวเลข</p>
          </div>
        </div>
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
  const { profile } = useLiffContext()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      setError(null)
      
      // 1. แปลงรูปเป็น base64
      const reader = new FileReader()
      reader.onload = async (event) => {
        const base64String = event.target?.result as string
        console.log('[v0] Image selected, starting upload to Google Drive')
        
        // 2. ส่ง base64 ไปยัง API
        try {
          const response = await fetch('/api/upload-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              base64Data: base64String.split(',')[1], // ลบ data:image/jpeg;base64, ออก
              fileName: `waste_${profile?.userId || 'unknown'}_${Date.now()}.jpg`,
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
            onImageChange(result.imageUrl) // เก็บ Google Drive URL แทน local URL
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
            // fallback ไปใช้ local URL ถ้าอัพโหลดล้มเหลว
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
          // fallback ไปใช้ local URL
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

  return (
    <div className="space-y-3">
      <label className="text-base font-semibold text-[#154212]">แนบรูปถ่าย</label>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Reference image */}
        {referenceImage && (
          <div className="flex flex-col items-center">
            <div className="w-full aspect-square bg-[#f5f5f5] rounded-xl overflow-hidden relative border-2 border-[#e5e5e5]">
              <Image
                src={referenceImage}
                alt="ตัวอย่าง"
                fill
                className="object-contain p-2"
              />
            </div>
            <span className="text-xs text-[#666666] mt-2 font-medium">{referenceLabel || 'ตัวอย่าง'}</span>
          </div>
        )}
        
        {/* Upload area */}
        <div className="flex flex-col items-center">
          <label className={cn(
            'w-full aspect-square rounded-xl overflow-hidden relative cursor-pointer',
            'border-2 border-dashed transition-colors',
            imageUrl 
              ? 'border-[#154212] bg-[#f0fdf0]' 
              : 'border-[#e5e5e5] bg-[#f5f5f5] hover:border-[#154212]',
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
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80">
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
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#666666]">
                <Camera className="w-10 h-10 mb-2" />
                <span className="text-sm font-medium">ถ่ายรูป</span>
              </div>
            )}
          </label>
          <span className="text-xs text-[#666666] mt-2 font-medium">
            {imageUrl ? 'รูปของคุณ' : 'กดเพื่อถ่ายรูป'}
          </span>
          {error && (
            <span className="text-xs text-[#c06161] mt-1 font-medium">{error}</span>
          )}
        </div>
      </div>
    </div>
  )
}
