'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { ArrowLeft, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/lib/admin-context'
import { cn } from '@/lib/utils'
import { compressImage } from '@/lib/compress-image'

export default function AdminAddRewardPage() {
  const { isAdmin } = useAdmin()
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [points, setPoints] = useState('')
  const [stock, setStock] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3 px-6">
        <p className="text-[#154212] font-semibold text-center">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        <button onClick={() => router.back()} className="text-sm text-[#154212]/60 underline">
          กลับ
        </button>
      </div>
    )
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { dataUrl } = await compressImage(file)
      setImagePreview(dataUrl)
    } catch {
      // fallback: อ่าน dataUrl ตรงๆ ถ้า compress ไม่ได้
      const reader = new FileReader()
      reader.onload = (ev) => setImagePreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'กรุณาระบุชื่อของรางวัล'
    if (!points.trim() || isNaN(Number(points)) || Number(points) <= 0)
      errs.points = 'กรุณาระบุคะแนนที่ถูกต้อง'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSubmitting(true)
    // TODO: POST to GAS / API route
    await new Promise((r) => setTimeout(r, 800))
    setSubmitting(false)
    router.back()
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-black/10 z-40">
        <div className="max-w-md mx-auto flex items-center h-[50px] px-4 gap-3">
          <button onClick={() => router.back()} className="text-[#154212]" aria-label="กลับ">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-[#154212]">เพิ่มรายการของรางวัล</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto px-4 py-6 space-y-5 pb-32">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-[#154212] mb-1.5">
            ชื่อของรางวัล <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })) }}
            placeholder="ระบุชื่อของรางวัล"
            className={cn(
              'w-full border rounded-xl px-4 py-3 text-sm text-[#154212] outline-none transition-colors',
              errors.name ? 'border-red-400 bg-red-50' : 'border-[#d1d5db] focus:border-[#154212]'
            )}
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        {/* Image */}
        <div>
          <label className="block text-sm font-medium text-[#154212] mb-1.5">รูปของรางวัล</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-[100px] h-[100px] border-2 border-dashed border-[#154212]/30 rounded-xl flex flex-col items-center justify-center gap-1 text-[#154212]/50 hover:border-[#154212]/60 transition-colors overflow-hidden"
          >
            {imagePreview ? (
              <Image src={imagePreview} alt="preview" width={100} height={100} className="object-cover w-full h-full" />
            ) : (
              <>
                <Plus className="w-6 h-6" />
                <span className="text-xs">เพิ่มรูป</span>
              </>
            )}
          </button>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[#154212] mb-1.5">คำอธิบาย</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="กรอกรายละเอียด"
            className="w-full border border-[#d1d5db] focus:border-[#154212] rounded-xl px-4 py-3 text-sm text-[#154212] outline-none transition-colors"
          />
        </div>

        {/* Points */}
        <div>
          <label className="block text-sm font-medium text-[#154212] mb-1.5">
            คะแนน <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={points}
            onChange={(e) => { setPoints(e.target.value); setErrors((p) => ({ ...p, points: '' })) }}
            placeholder="ระบุคะแนน"
            className={cn(
              'w-full border rounded-xl px-4 py-3 text-sm text-[#154212] outline-none transition-colors',
              errors.points ? 'border-red-400 bg-red-50' : 'border-[#d1d5db] focus:border-[#154212]'
            )}
          />
          {errors.points && <p className="text-xs text-red-500 mt-1">{errors.points}</p>}
        </div>

        {/* Stock */}
        <div>
          <label className="block text-sm font-medium text-[#154212] mb-1.5">จำนวนในสต๊อก</label>
          <input
            type="number"
            inputMode="numeric"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="ระบุจำนวน"
            className="w-full border border-[#d1d5db] focus:border-[#154212] rounded-xl px-4 py-3 text-sm text-[#154212] outline-none transition-colors"
          />
        </div>
      </form>

      {/* Submit — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e5e5e5] px-4 py-4">
        <div className="max-w-md mx-auto">
          <button
            type="submit"
            form=""
            disabled={submitting}
            onClick={handleSubmit as any}
            className="w-full py-4 rounded-xl bg-[#154212] text-white font-semibold text-base disabled:opacity-50 transition-opacity"
          >
            {submitting ? 'กำลังบันทึก…' : 'เสร็จสิ้น'}
          </button>
        </div>
      </div>
    </div>
  )
}
