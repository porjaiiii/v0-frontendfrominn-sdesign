'use client'

import { useId, useRef, useState } from 'react'
import Image from 'next/image'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compressImage } from '@/lib/compress-image'
import { uploadCatalogImage } from '@/lib/api-client'

export interface RewardFormInitial {
  name: string
  description: string
  points: number
  /** null = unlimited, shown as an empty box. */
  stock: number | null
  /** Current image URL, or '' for none. */
  image: string
}

/**
 * What the admin typed, shaped as the body fields of POST /api/catalog/rewards
 * and PATCH /api/catalog/rewards/[id].
 */
export interface RewardFormValues {
  name: string
  description: string
  /** Absent when `pointsLocked` — the server refuses to reprice those. */
  points?: number
  /** An empty box is null, which means unlimited. */
  stock: number | null
  /** Storage path of a newly picked image. Absent keeps the current one. */
  imagePath?: string
}

interface RewardFormProps {
  initial?: RewardFormInitial
  /** For a variable reward (cash-back), whose points are a floor, not a price. */
  pointsLocked?: boolean
  /** Throw to show the message and let the admin try again. */
  onSubmit: (values: RewardFormValues) => Promise<void>
}

// Shared by app/admin/rewards/new/page.tsx and app/admin/rewards/[id]/edit/page.tsx.
export function RewardForm({ initial, pointsLocked = false, onSubmit }: RewardFormProps) {
  const id = useId()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [points, setPoints] = useState(initial ? String(initial.points) : '')
  const [stock, setStock] = useState(initial?.stock != null ? String(initial.stock) : '')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<Blob | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const shownImage = imagePreview ?? (initial?.image || null)

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { dataUrl, blob } = await compressImage(file)
      setImagePreview(dataUrl)
      // The compressed Blob, not the raw file, is what gets uploaded on
      // submit — same compress-then-upload shape as evidence photos.
      setImageFile(blob)
    } catch {
      // fallback: อ่าน dataUrl ตรงๆ ถ้า compress ไม่ได้
      const reader = new FileReader()
      reader.onload = (ev) => setImagePreview(ev.target?.result as string)
      reader.readAsDataURL(file)
      setImageFile(file)
    }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'กรุณาระบุชื่อของรางวัล'
    if (!pointsLocked && (!points.trim() || isNaN(Number(points)) || Number(points) <= 0))
      errs.points = 'กรุณาระบุคะแนนที่ถูกต้อง'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const values: RewardFormValues = {
        name,
        description,
        stock: stock.trim() ? Number(stock) : null,
      }
      if (!pointsLocked) values.points = Number(points)
      if (imageFile) values.imagePath = await uploadCatalogImage(imageFile, 'rewards')

      await onSubmit(values)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto px-4 py-6 space-y-5 pb-32">
      {/* Name */}
      <div>
        <label htmlFor={`${id}-name`} className="block text-sm font-medium text-[#154212] mb-1.5">
          ชื่อของรางวัล <span className="text-red-500">*</span>
        </label>
        <input
          id={`${id}-name`}
          name="name"
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
          aria-label={shownImage ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}
          className="w-[100px] h-[100px] border-2 border-dashed border-[#154212]/30 rounded-xl flex flex-col items-center justify-center gap-1 text-[#154212]/50 hover:border-[#154212]/60 transition-colors overflow-hidden"
        >
          {shownImage ? (
            <Image src={shownImage} alt="preview" width={100} height={100} className="object-cover w-full h-full" />
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
        <label htmlFor={`${id}-description`} className="block text-sm font-medium text-[#154212] mb-1.5">
          คำอธิบาย
        </label>
        <input
          id={`${id}-description`}
          name="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="กรอกรายละเอียด"
          className="w-full border border-[#d1d5db] focus:border-[#154212] rounded-xl px-4 py-3 text-sm text-[#154212] outline-none transition-colors"
        />
      </div>

      {/* Points */}
      <div>
        <label htmlFor={`${id}-points`} className="block text-sm font-medium text-[#154212] mb-1.5">
          คะแนน <span className="text-red-500">*</span>
        </label>
        <input
          id={`${id}-points`}
          name="points"
          type="number"
          inputMode="numeric"
          value={points}
          disabled={pointsLocked}
          onChange={(e) => { setPoints(e.target.value); setErrors((p) => ({ ...p, points: '' })) }}
          placeholder="ระบุคะแนน"
          className={cn(
            'w-full border rounded-xl px-4 py-3 text-sm text-[#154212] outline-none transition-colors disabled:bg-[#f5f5f5] disabled:text-[#999]',
            errors.points ? 'border-red-400 bg-red-50' : 'border-[#d1d5db] focus:border-[#154212]'
          )}
        />
        {pointsLocked && (
          <p className="text-xs text-[#666] mt-1">
            ของรางวัลนี้ผู้ใช้กำหนดจำนวนคะแนนเอง จึงแก้ไขคะแนนขั้นต่ำไม่ได้
          </p>
        )}
        {errors.points && <p className="text-xs text-red-500 mt-1">{errors.points}</p>}
      </div>

      {/* Stock */}
      <div>
        <label htmlFor={`${id}-stock`} className="block text-sm font-medium text-[#154212] mb-1.5">
          จำนวนในสต๊อก
        </label>
        <input
          id={`${id}-stock`}
          name="stock"
          type="number"
          inputMode="numeric"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          placeholder="ไม่จำกัดจำนวน"
          className="w-full border border-[#d1d5db] focus:border-[#154212] rounded-xl px-4 py-3 text-sm text-[#154212] outline-none transition-colors"
        />
      </div>

      {/* Submit — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e5e5e5] px-4 py-4">
        <div className="max-w-md mx-auto">
          {submitError && (
            <p role="alert" className="text-xs text-red-500 mb-2 text-center">{submitError}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-xl bg-[#154212] text-white font-semibold text-base disabled:opacity-50 transition-opacity"
          >
            {submitting ? 'กำลังบันทึก…' : 'เสร็จสิ้น'}
          </button>
        </div>
      </div>
    </form>
  )
}
