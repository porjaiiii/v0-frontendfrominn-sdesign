'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, ChevronDown, ChevronUp, Loader2, QrCode, Trash2, X } from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { useAdmin } from '@/lib/admin-context'
import { useApp, type WasteType } from '@/lib/app-context'
import { apiFetch, newIdempotencyKey, uploadWastePhoto } from '@/lib/api-client'
import { compressImage } from '@/lib/compress-image'
import { useLiffContext } from '@/lib/liff-context'
import { pointsPerKgFor } from '@/lib/rates'
import { WASTE_SUBTYPES, WASTE_TYPES } from '@/lib/waste-data'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// หน้าบันทึกขยะ (เจ้าหน้าที่) — flow เดียวจบในหน้าเดียว
//
//   1. แอดมินสแกน QR ของผู้ใช้  → ข้อมูลผู้ใช้ขึ้นด้านบน (กรอกให้ใครอยู่)
//   2. กดเลือกประเภทย่อยได้หลายครั้ง → แต่ละครั้งเพิ่มหนึ่งแถวในรายการ
//   3. แต่ละแถวใส่น้ำหนัก + แนบรูป (หลายรูปพร้อมกัน) ได้เลย
//   4. กดบันทึก → ส่งไปหลังบ้านทีละแถว (POST /api/admin/waste/submit)
//
// หลังบ้านรับทีละก้อนเหมือนเดิม: แต่ละแถวมี Idempotency-Key ของตัวเอง ดังนั้นการ
// กดซ้ำหรือส่งใหม่หลังเน็ตหลุดจะไม่สร้างรายการซ้ำ
// ─────────────────────────────────────────────────────────────────────────────

interface ScannedUser {
  lineUserId: string
  userId: string
  fullName: string
  nickname: string
  userType: string
  subdistrict: string
  pictureUrl?: string
}

interface Photo {
  id: string
  preview: string
  /** Storage path once uploaded; null while uploading or after a failure. */
  path: string | null
  state: 'uploading' | 'done' | 'error'
}

interface LineItem {
  uid: string
  typeId: WasteType
  subTypeId: string
  name: string
  typeName: string
  weight: string
  photos: Photo[]
  /** Held for the life of the row so a re-send replays instead of duplicating. */
  key: string
  status: 'idle' | 'saving' | 'error'
  error?: string
}

interface SaveSummary {
  count: number
  weight: number
  points: number
  carbon: number
}

const SUBTYPE_IMAGES: Record<string, string> = {
  pet: '/waste/plastic/pet.png',
  hdpe: '/waste/plastic/hdpe.png',
  ldpe: '/waste/plastic/ldpe.png',
  cardboard: '/waste/paper/cardboard.png',
  a4: '/waste/paper/a4.png',
  mixed: '/waste/paper/mixed.png',
  clear: '/waste/glass/clear.png',
  colored: '/waste/glass/colored.png',
  can: '/waste/aluminium/can.png',
  plate: '/waste/aluminium/plate.png',
  scrap: '/waste/aluminium/scrap.png',
}

const TYPE_FALLBACK_IMAGES: Record<string, string> = {
  plastic: '/waste/plastic/plastic.png',
  paper: '/waste/paper/paper.png',
  glass: '/waste/glass/glass.png',
  aluminum: '/waste/aluminium/aluminum.png',
}

const MAX_WEIGHT = 10_000
const VISIBLE_TYPES = WASTE_TYPES.filter((t) => t.id !== 'oil')

/** The user's QR holds `${origin}/profile-view/${lineUserId}`; accept a bare id too. */
function extractLineUserId(scanned: string): string {
  const value = scanned.trim()
  const match = /\/profile-view\/([^/?#]+)/.exec(value)
  if (match) {
    try {
      return decodeURIComponent(match[1])
    } catch {
      return match[1]
    }
  }
  return value
}

function parseWeight(raw: string): number {
  const n = parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export default function HomePage() {
  const { isAdmin, isInitializing } = useAdmin()
  const { wasteRates } = useApp()
  const { scanCode, isReady, isInClient } = useLiffContext()

  const [target, setTarget] = useState<ScannedUser | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [manualId, setManualId] = useState('')

  const [openType, setOpenType] = useState<WasteType | null>('plastic')
  const [items, setItems] = useState<LineItem[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmNoPhoto, setConfirmNoPhoto] = useState(false)
  const [summary, setSummary] = useState<SaveSummary | null>(null)

  // Latest items for unmount cleanup without re-subscribing the effect.
  const itemsRef = useRef(items)
  itemsRef.current = items
  useEffect(
    () => () => {
      itemsRef.current.forEach((it) => it.photos.forEach((p) => URL.revokeObjectURL(p.preview)))
    },
    [],
  )

  // ── derived ──────────────────────────────────────────────────────────────
  // Points are priced per SUBTYPE from the live catalog (GET /api/catalog/waste-types).
  // null = the rate is not known yet, shown as "—" rather than a guess. This is
  // only an estimate; the server prices the real award when the row is saved.
  const pointsFor = (item: LineItem): number | null => {
    const rate = pointsPerKgFor(item.typeId, item.subTypeId, wasteRates)
    return rate === null ? null : Math.round(parseWeight(item.weight) * rate)
  }

  const totalWeight = items.reduce((sum, it) => sum + parseWeight(it.weight), 0)
  const itemPoints = items.map(pointsFor)
  const totalPoints = itemPoints.some((p) => p === null)
    ? null
    : itemPoints.reduce<number>((sum, p) => sum + (p ?? 0), 0)
  const isUploading = items.some((it) => it.photos.some((p) => p.state === 'uploading'))
  const allWeighed = items.length > 0 && items.every((it) => parseWeight(it.weight) > 0)
  const canSave = Boolean(target) && allWeighed && !isUploading && !isSaving
  const missingPhotos = items.filter((it) => !it.photos.some((p) => p.state === 'done')).length

  // ── scanning ─────────────────────────────────────────────────────────────
  const loadUser = useCallback(async (raw: string) => {
    const lineUserId = extractLineUserId(raw)
    if (!lineUserId) {
      setScanError('ไม่สามารถอ่าน QR Code ได้ โปรดลองใหม่อีกครั้ง')
      return
    }

    // Staff read somebody else's profile through the admin route, which checks the
    // admin session cookie. /api/profile/[id] is now self-only.
    const res = await fetch(`/api/admin/profile/${encodeURIComponent(lineUserId)}`, {
      cache: 'no-store',
    })
    if (res.status === 401) {
      setScanError('สิทธิ์แอดมินหมดอายุ กรุณาเข้าสู่ระบบแอดมินอีกครั้ง')
      return
    }
    if (res.status === 404) {
      setScanError('ไม่พบผู้ใช้นี้ในระบบ (ผู้ใช้ต้องลงทะเบียนก่อน)')
      return
    }
    if (!res.ok) {
      setScanError('ดึงข้อมูลผู้ใช้ไม่สำเร็จ โปรดลองใหม่อีกครั้ง')
      return
    }

    const data = await res.json()
    setTarget({
      lineUserId: data.lineUserId || lineUserId,
      userId: data.userId,
      fullName: data.fullName,
      nickname: data.nickname,
      userType: data.userType,
      subdistrict: data.subdistrict,
    })
    setScanError(null)
  }, [])

  const clearItems = useCallback(() => {
    setItems((prev) => {
      prev.forEach((it) => it.photos.forEach((p) => URL.revokeObjectURL(p.preview)))
      return []
    })
    setSaveError(null)
  }, [])

  const startScan = async () => {
    if (items.length > 0 && !window.confirm('การเปลี่ยนผู้ใช้จะล้างรายการที่ยังไม่บันทึก ต้องการดำเนินการต่อหรือไม่?')) {
      return
    }
    if (!isReady) {
      setScanError('LIFF ยังไม่พร้อม โปรดรอสักครู่...')
      return
    }

    setIsScanning(true)
    setScanError(null)
    try {
      const result = await scanCode()
      if (!result.value) {
        setScanError('ไม่สามารถอ่าน QR Code ได้ โปรดลองใหม่อีกครั้ง')
        return
      }
      clearItems()
      await loadUser(result.value)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'ไม่สามารถเปิดกล้องสแกน QR Code ได้')
    } finally {
      setIsScanning(false)
    }
  }

  // Outside the LINE app there is no camera scanner; this keeps the page
  // testable from a desktop browser.
  const submitManual = async () => {
    if (!manualId.trim()) return
    setIsScanning(true)
    setScanError(null)
    try {
      clearItems()
      await loadUser(manualId)
      setManualId('')
    } catch {
      setScanError('ดึงข้อมูลผู้ใช้ไม่สำเร็จ โปรดลองใหม่อีกครั้ง')
    } finally {
      setIsScanning(false)
    }
  }

  // ── list editing ─────────────────────────────────────────────────────────
  const addItem = (typeId: WasteType, subTypeId: string, name: string) => {
    const typeName = WASTE_TYPES.find((t) => t.id === typeId)?.name ?? ''
    setItems((prev) => [
      ...prev,
      {
        uid: newIdempotencyKey(),
        typeId,
        subTypeId,
        name: name.replace(/\s*\n\s*/g, ' '),
        typeName,
        weight: '',
        photos: [],
        key: newIdempotencyKey(),
        status: 'idle',
      },
    ])
  }

  const patchItem = (uid: string, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)))

  const removeItem = (uid: string) =>
    setItems((prev) => {
      prev.find((it) => it.uid === uid)?.photos.forEach((p) => URL.revokeObjectURL(p.preview))
      return prev.filter((it) => it.uid !== uid)
    })

  const setWeight = (uid: string, raw: string) => {
    if (raw !== '' && !/^\d*\.?\d{0,3}$/.test(raw)) return
    if (raw !== '' && parseFloat(raw) > MAX_WEIGHT) return
    patchItem(uid, { weight: raw })
  }

  const patchPhoto = (uid: string, photoId: string, patch: Partial<Photo>) =>
    setItems((prev) =>
      prev.map((it) =>
        it.uid === uid
          ? { ...it, photos: it.photos.map((p) => (p.id === photoId ? { ...p, ...patch } : p)) }
          : it,
      ),
    )

  const removePhoto = (uid: string, photoId: string) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.uid !== uid) return it
        it.photos.filter((p) => p.id === photoId).forEach((p) => URL.revokeObjectURL(p.preview))
        return { ...it, photos: it.photos.filter((p) => p.id !== photoId) }
      }),
    )

  // Several files at once: every one is added right away and uploads in
  // parallel, each reporting its own state.
  const addPhotos = (uid: string, files: FileList | null) => {
    if (!files || files.length === 0 || !target) return

    const picked = Array.from(files).map((file) => ({
      file,
      photo: {
        id: newIdempotencyKey(),
        preview: URL.createObjectURL(file),
        path: null,
        state: 'uploading',
      } as Photo,
    }))

    setItems((prev) =>
      prev.map((it) => (it.uid === uid ? { ...it, photos: [...it.photos, ...picked.map((x) => x.photo)] } : it)),
    )

    for (const { file, photo } of picked) {
      void (async () => {
        try {
          const { blob } = await compressImage(file)
          const path = await uploadWastePhoto(blob, {
            fileName: `${target.lineUserId}_${Date.now()}.jpg`,
            userId: target.lineUserId,
          })
          patchPhoto(uid, photo.id, { path, state: 'done' })
        } catch (err) {
          console.error('[home] photo upload failed:', err)
          patchPhoto(uid, photo.id, { state: 'error' })
        }
      })()
    }
  }

  // ── saving ───────────────────────────────────────────────────────────────
  const handleSaveClick = () => {
    if (!canSave) return
    if (missingPhotos > 0) setConfirmNoPhoto(true)
    else void doSave()
  }

  const doSave = async () => {
    if (!target) return
    setConfirmNoPhoto(false)
    setIsSaving(true)
    setSaveError(null)

    const batch = itemsRef.current
    const saved: string[] = []
    const total: SaveSummary = { count: 0, weight: 0, points: 0, carbon: 0 }

    // One at a time, as the backend expects.
    for (const item of batch) {
      patchItem(item.uid, { status: 'saving', error: undefined })
      try {
        const res = await apiFetch('/api/admin/waste/submit', {
          method: 'POST',
          idempotencyKey: item.key,
          body: JSON.stringify({
            target_user_id: target.lineUserId,
            waste_type: item.typeId,
            waste_subtype: item.subTypeId,
            weight_kg: parseWeight(item.weight),
            image_urls: item.photos.flatMap((p) => (p.path ? [p.path] : [])),
          }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok || !body?.success) {
          throw new Error(
            res.status === 403
              ? 'สิทธิ์แอดมินหมดอายุ กรุณาเข้าสู่ระบบแอดมินอีกครั้ง'
              : (body?.error ?? 'บันทึกไม่สำเร็จ'),
          )
        }
        saved.push(item.uid)
        total.count += 1
        total.weight += Number(body.data?.weight_kg) || 0
        total.points += Number(body.data?.points_earned) || 0
        total.carbon += Number(body.data?.carbon_reduction) || 0
      } catch (err) {
        patchItem(item.uid, {
          status: 'error',
          error: err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ',
        })
      }
    }

    // Saved rows leave the list; failed ones stay, with their key, to retry.
    setItems((prev) => {
      prev.filter((it) => saved.includes(it.uid)).forEach((it) => it.photos.forEach((p) => URL.revokeObjectURL(p.preview)))
      return prev.filter((it) => !saved.includes(it.uid))
    })

    const failed = batch.length - saved.length
    if (failed > 0) setSaveError(`บันทึกไม่สำเร็จ ${failed} รายการ — ตรวจสอบแล้วกดบันทึกอีกครั้ง`)
    if (total.count > 0) setSummary(total)
    setIsSaving(false)
  }

  // ── gates ────────────────────────────────────────────────────────────────
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader />
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#154212]" />
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader />
        <main className="max-w-md mx-auto px-4 py-10">
          <div className="rounded-2xl border border-[#e5e5e5] bg-[#f5f7f4] p-6 text-center space-y-2">
            <h1 className="text-lg font-semibold text-[#154212]">หน้านี้สำหรับเจ้าหน้าที่</h1>
            <p className="text-sm text-[#555555]">
              เข้าสู่ระบบแอดมินจากเมนูมุมขวาบน เพื่อสแกน QR ของผู้ใช้และบันทึกขยะให้
            </p>
          </div>
        </main>
      </div>
    )
  }

  // ── page ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white pb-10">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 1) ผู้ใช้ที่กำลังกรอกให้ */}
        <section className="rounded-2xl bg-[#f0f4ee] p-4">
          {target ? (
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 shrink-0 rounded-full bg-[#c9d6c5] overflow-hidden flex items-center justify-center text-2xl font-semibold text-[#154212]">
                {target.pictureUrl ? (
                  <Image src={target.pictureUrl} alt="" fill className="object-cover" />
                ) : (
                  (target.fullName || target.nickname || '?').slice(0, 1)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#666666]">กำลังบันทึกให้</p>
                <p className="text-lg font-semibold text-[#154212] truncate">
                  {target.fullName || target.nickname || '-'}
                </p>
                <p className="text-xs text-[#555555] truncate">
                  {[target.nickname && `(${target.nickname})`, target.userId, target.userType]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={startScan}
                disabled={isScanning || isSaving}
                className="shrink-0 rounded-full border border-[#154212] px-3 py-1.5 text-xs font-semibold text-[#154212] disabled:opacity-50"
              >
                {isScanning ? 'กำลังสแกน...' : 'เปลี่ยนผู้ใช้'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 shrink-0 rounded-full bg-[#c9d6c5] flex items-center justify-center">
                  <QrCode className="w-7 h-7 text-[#154212]" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-[#154212]">ข้อมูล user</p>
                  <p className="text-xs text-[#555555]">สแกน QR Code ของผู้ใช้ก่อนเริ่มบันทึก</p>
                </div>
              </div>
              <button
                type="button"
                onClick={startScan}
                disabled={isScanning}
                className="w-full rounded-full bg-[#154212] py-3 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {isScanning ? 'กำลังสแกน...' : 'เปิดกล้องสแกน QR'}
              </button>

              {!isInClient && (
                <div className="flex gap-2">
                  <input
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    placeholder="เปิดนอก LINE: วางลิงก์ QR หรือ LINE ID"
                    className="min-w-0 flex-1 rounded-full border border-[#c9d6c5] bg-white px-4 py-2 text-xs focus:border-[#154212] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={submitManual}
                    disabled={isScanning || !manualId.trim()}
                    className="shrink-0 rounded-full border border-[#154212] px-4 py-2 text-xs font-semibold text-[#154212] disabled:opacity-50"
                  >
                    ค้นหา
                  </button>
                </div>
              )}
            </div>
          )}
          {scanError && <p className="mt-3 text-xs font-medium text-red-600">{scanError}</p>}
        </section>

        {/* 2) เลือกประเภทขยะ */}
        <section
          className={cn(
            'rounded-2xl bg-[#f0f4ee] p-4 transition-opacity',
            !target && 'opacity-50 pointer-events-none',
          )}
          aria-disabled={!target}
        >
          <h2 className="text-lg font-semibold text-[#154212] mb-3">เลือกประเภทขยะ</h2>
          <div className="space-y-2">
            {VISIBLE_TYPES.map((type) => {
              const open = openType === type.id
              return (
                <div key={type.id} className="rounded-2xl border border-[#154212]/30 bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenType(open ? null : type.id)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="text-base font-semibold text-[#154212]">{type.name}</span>
                    {open ? (
                      <ChevronUp className="w-5 h-5 text-[#154212]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#154212]" />
                    )}
                  </button>

                  {open && (
                    <div className="grid grid-cols-2 gap-3 px-3 pb-3">
                      {WASTE_SUBTYPES[type.id].map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => addItem(type.id, sub.id, sub.name)}
                          className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-[#f0f4ee] p-3 active:scale-95 transition-transform hover:ring-2 hover:ring-[#157b03]"
                        >
                          <div className="relative w-16 h-16">
                            <Image
                              src={SUBTYPE_IMAGES[sub.id] ?? TYPE_FALLBACK_IMAGES[type.id]}
                              alt=""
                              fill
                              className="object-contain"
                            />
                          </div>
                          <span className="text-xs font-semibold text-black text-center whitespace-pre-line leading-tight">
                            {sub.name}
                          </span>
                          {sub.description && (
                            <span className="text-[10px] text-[#666666]">{sub.description}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* 3) รายการบันทึก */}
        <section className="rounded-2xl bg-[#f0f4ee] p-4">
          <h2 className="text-lg font-semibold text-[#154212] mb-3">รายการบันทึก</h2>

          <div className="rounded-xl border border-[#154212]/40 bg-white overflow-hidden">
            <div className="grid grid-cols-[1.5rem_1fr_3.25rem_4rem_2.75rem_1.75rem] items-center gap-1 border-b border-[#154212]/40 px-2 py-2 text-center text-xs text-[#444444]">
              <span>no.</span>
              <span>รายการ</span>
              <span>รูป</span>
              <span>น้ำหนัก</span>
              <span>คะแนน</span>
              <span>ลบ</span>
            </div>

            <div className="min-h-40 divide-y divide-[#eeeeee]">
              {items.length === 0 && (
                <p className="px-4 py-10 text-center text-xs text-[#999999]">
                  {target ? 'แตะประเภทขยะด้านบนเพื่อเพิ่มรายการ' : 'สแกน QR ของผู้ใช้เพื่อเริ่มบันทึก'}
                </p>
              )}

              {items.map((item, index) => (
                <div key={item.uid} className={cn('px-2 py-2', item.status === 'error' && 'bg-red-50')}>
                  <div className="grid grid-cols-[1.5rem_1fr_3.25rem_4rem_2.75rem_1.75rem] items-center gap-1 text-center text-sm">
                    <span className="text-[#444444]">{index + 1}</span>
                    <div className="min-w-0 text-left leading-tight">
                      <p className="line-clamp-2 break-words text-[12px] text-black">{item.name}</p>
                      <p className="truncate text-[10px] text-[#888888]">{item.typeName}</p>
                    </div>

                    {/* แนบรูปได้หลายรูปพร้อมกัน */}
                    <label
                      className={cn(
                        'relative mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border',
                        item.photos.length > 0 ? 'border-[#154212] bg-[#f0fdf0]' : 'border-[#bbbbbb]',
                      )}
                      aria-label="แนบรูป"
                    >
                      <Camera className="w-4 h-4 text-[#154212]" />
                      {item.photos.length > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#154212] px-1 text-[10px] text-white">
                          {item.photos.length}
                        </span>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={item.status === 'saving' || isSaving}
                        onChange={(e) => {
                          addPhotos(item.uid, e.target.files)
                          e.target.value = ''
                        }}
                      />
                    </label>

                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.weight}
                      onChange={(e) => setWeight(item.uid, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0.00"
                      disabled={item.status === 'saving' || isSaving}
                      aria-label={`น้ำหนัก ${item.name}`}
                      className="w-full rounded border border-[#888888] px-1 py-1 text-center text-sm focus:border-[#154212] focus:outline-none disabled:bg-[#f5f5f5]"
                    />

                    <span className="text-[#154212] tabular-nums">{pointsFor(item) ?? '—'}</span>

                    <button
                      type="button"
                      onClick={() => removeItem(item.uid)}
                      disabled={item.status === 'saving' || isSaving}
                      aria-label={`ลบ ${item.name}`}
                      className="mx-auto flex h-7 w-7 items-center justify-center rounded text-[#444444] hover:text-red-600 disabled:opacity-40"
                    >
                      {item.status === 'saving' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {item.photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 pl-6">
                      {item.photos.map((photo) => (
                        <div
                          key={photo.id}
                          className={cn(
                            'relative h-14 w-14 overflow-hidden rounded-lg border-2',
                            photo.state === 'error' ? 'border-red-500' : 'border-[#154212]',
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.preview} alt="หลักฐาน" className="h-full w-full object-cover" />
                          {photo.state === 'uploading' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                              <Loader2 className="w-4 h-4 animate-spin text-[#154212]" />
                            </div>
                          )}
                          {photo.state === 'error' && (
                            <div className="absolute inset-x-0 bottom-0 bg-red-500 text-center text-[9px] text-white">
                              ไม่สำเร็จ
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removePhoto(item.uid, photo.id)}
                            disabled={isSaving}
                            aria-label="ลบรูป"
                            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {item.error && <p className="mt-1 pl-6 text-[11px] font-medium text-red-600">{item.error}</p>}
                </div>
              ))}
            </div>

            <div className="border-t border-[#154212]/40 px-3 py-2 text-sm text-[#333333]">
              <div className="flex justify-between">
                <span>รวม</span>
                <span className="tabular-nums">
                  {totalWeight.toFixed(2)} <span className="ml-1">กก.</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span>{items.length} รายการ</span>
                <span className="tabular-nums">
                  {totalPoints ?? '—'} <span className="ml-1">คะแนน</span>
                </span>
              </div>
            </div>
          </div>

          {saveError && <p className="mt-3 text-xs font-medium text-red-600">{saveError}</p>}
          {isUploading && <p className="mt-3 text-xs text-[#666666]">กำลังอัปโหลดรูป...</p>}

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={clearItems}
              disabled={items.length === 0 || isSaving}
              className="rounded-full border border-[#154212] px-4 py-2 text-sm font-semibold text-[#154212] disabled:opacity-40"
            >
              ยกเลิกรายการ
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={!canSave}
              className={cn(
                'rounded-full px-8 py-2 text-sm font-semibold transition-colors',
                canSave ? 'bg-[#154212] text-white hover:bg-[#0d3308]' : 'bg-[#cfcfcf] text-[#888888] cursor-not-allowed',
              )}
            >
              {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </section>
      </main>

      {/* ยืนยันเมื่อบางรายการยังไม่มีรูป */}
      {confirmNoPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl space-y-4">
            <h3 className="text-lg font-semibold text-[#154212]">บางรายการยังไม่มีรูปหลักฐาน</h3>
            <p className="text-sm text-[#555555]">มี {missingPhotos} รายการที่ไม่ได้แนบรูป ต้องการบันทึกต่อหรือไม่?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmNoPhoto(false)}
                className="flex-1 rounded-full border border-[#154212] py-2.5 text-sm font-semibold text-[#154212]"
              >
                กลับไปแก้ไข
              </button>
              <button
                type="button"
                onClick={() => void doSave()}
                className="flex-1 rounded-full bg-[#154212] py-2.5 text-sm font-semibold text-white"
              >
                บันทึกเลย
              </button>
            </div>
          </div>
        </div>
      )}

      {/* บันทึกสำเร็จ */}
      {summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl space-y-4">
            <div className="text-4xl">&#127807;</div>
            <h3 className="text-lg font-semibold text-[#154212]">บันทึกข้อมูลสำเร็จ</h3>
            <p className="text-sm text-[#555555]">
              {target?.fullName || target?.nickname} · {summary.count} รายการ · {summary.weight.toFixed(2)} กก.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-[#f0f4ee] p-3">
                <p className="text-xs text-[#666666]">คะแนนที่ได้</p>
                <p className="text-xl font-semibold text-[#154212]">{summary.points}</p>
              </div>
              <div className="rounded-2xl bg-[#f0f4ee] p-3">
                <p className="text-xs text-[#666666]">ลดคาร์บอน (kgCO₂e)</p>
                <p className="text-xl font-semibold text-[#154212]">{summary.carbon.toFixed(2)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSummary(null)}
              className="w-full rounded-full bg-[#154212] py-2.5 text-sm font-semibold text-white"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
