'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { useLiffContext } from '@/lib/liff-context'
import { generateUserIdFromLineId } from '@/lib/user-id-generator'

const OCCUPATIONS = [
  'ผู้ประกอบการ (ร้านค้า/โฮมสเตย์)',
  'เกษตรกร',
  'ข้าราชการ/พนักงานของรัฐ',
  'พนักงานบริษัทเอกชน',
  'รับจ้างทั่วไป',
  'นักเรียน/นักศึกษา',
  'ผู้เกษียณอายุ/ว่างงาน',
  'อื่นๆ',
]

const SUBDISTRICTS = [
  'ทรงคนอง',
  'บางกระสอบ',
  'บางน้ำผึ้ง',
  'บางยอ',
  'บางกอบัว',
  'บางกะเจ้า',
  'อื่น ๆ',
]

const GENDERS = ['ชาย', 'หญิง', 'LGBTQ+', 'ไม่ระบุ']
const AGE_RANGES = ['ต่ำกว่า 25', '26-45', '46-60', '61 ปีขึ้นไป']
const USER_TYPES = ['คนในชุมชนคุ้งบางกะเจ้า', 'นักท่องเที่ยว']

// Tour steps — fieldId matches the id attribute on each form field
const TOUR_STEPS = [
  {
    fieldId: 'field-userType',
    title: 'ประเภทผู้ใช้งาน',
    message: 'คุณเป็นคนในชุมชนคุ้งบางกะเจ้าหรือนักท่องเที่ยวครับ? เลือกให้ตรงกับสถานะของคุณเลย',
  },
  {
    fieldId: 'field-fullName',
    title: 'ชื่อ-นามสกุล',
    message: 'เริ่มต้นด้วยการกรอกชื่อนามสกุลของท่าน',
  },
  {
    fieldId: 'field-phoneNumber',
    title: 'เบอร์ติดต่อ',
    message: 'กรอกเบอร์โทรศัพท์ที่ติดต่อได้ครับ เจ้าหน้าที่จะใช้เบอร์นี้เมื่อจำเป็นต้องติดต่อกับท่าน',
  },
  {
    fieldId: 'field-gender',
    title: 'เพศ',
    message: 'เลือกเพศของคุณครับ ข้อมูลนี้ใช้สำหรับสถิติการจัดการขยะในชุมชนเท่านั้น',
  },
  {
    fieldId: 'field-ageRange',
    title: 'ช่วงอายุ',
    message: 'เลือกช่วงอายุที่ตรงกับคุณครับ ไม่ต้องระบุอายุจริงแค่ช่วงอายุก็พอครับ',
  },
  {
    fieldId: 'field-subdistrict',
    title: 'ตำบล',
    message: 'เลือกตำบลที่คุณอาศัยอยู่ครับ ถ้าไม่ได้อยู่ในรายการก็เลือก "อื่นๆ" ได้เลยครับ',
  },
  {
    fieldId: 'field-occupation',
    title: 'อาชีพ',
    message: 'เลือกอาชีพที่ตรงกับคุณ แล้วกด "ลงทะเบียน" ได้เลยครับ',
  },
]

const PDPA_TEXT = `นโยบายการคุ้มครองข้อมูลส่วนบุคคล (PDPA)

โครงการ Digital Wasted Account ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของท่าน ข้อมูลที่เก็บรวบรวม ได้แก่ ชื่อ-นามสกุล เบอร์ติดต่อ เพศ ช่วงอายุ ตำบลที่อยู่อาศัย และอาชีพ

วัตถุประสงค์การใช้ข้อมูล
- เพื่อจัดการและติดตามข้อมูลขยะในชุมชนคุ้งบางกะเจ้า
- เพื่อประสานงานกับเจ้าหน้าที่เก็บขยะ
- เพื่อวิเคราะห์สถิติการลดขยะและคาร์บอนในชุมชน

ข้อมูลของท่านจะถูกเก็บรักษาอย่างปลอดภัยและจะไม่ถูกเปิดเผยต่อบุคคลภายนอกโดยไม่ได้รับความยินยอม ท่านมีสิทธิ์ขอดู แก้ไข หรือลบข้อมูลของตนเองได้ตลอดเวลา`

// Reusable choice-button group
function ChoiceGroup({
  options,
  value,
  onChange,
  multi = false,
  highlighted = false,
}: {
  options: string[]
  value: string | string[]
  onChange: (val: string) => void
  multi?: boolean
  highlighted?: boolean
}) {
  const isSelected = (opt: string) =>
    multi ? (value as string[]).includes(opt) : value === opt

  return (
    <div className={`flex flex-wrap gap-2 ${highlighted ? 'relative z-[60]' : ''}`}>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-all select-none
            ${isSelected(opt)
              ? 'bg-[#154212] text-white border-[#154212] shadow-sm'
              : 'bg-white text-gray-700 border-[#d1d5db] hover:border-[#154212] hover:text-[#154212]'
            }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export default function RegisterPage() {
  const { profile } = useLiffContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pdpaExpanded, setPdpaExpanded] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [tourStep, setTourStep] = useState(0)
  const [bubblePos, setBubblePos] = useState<{ top: number; bottom: number; useBottom: boolean } | null>(null)
  const tourStarted = useRef(false)

  const [formData, setFormData] = useState({
    lineUserId: '',
    userId: '',
    pdpaConsent: false,
    fullName: '',
    phoneNumber: '',
    gender: '',
    ageRange: '',
    userType: '',
    subdistrict: '',
    occupation: '',
    // houseNumber is mock-only — not sent to the API
    houseNumber: '',
  })

  useEffect(() => {
    if (profile?.userId) {
      const generatedUserId = generateUserIdFromLineId(profile.userId)
      setFormData(prev => ({
        ...prev,
        lineUserId: profile.userId,
        userId: generatedUserId,
        fullName: profile.displayName || '',
      }))
    }
  }, [profile])

  const measureBubble = useCallback(() => {
    if (!showTour) return
    const step = TOUR_STEPS[tourStep]
    if (!step) return
    const el = document.getElementById(step.fieldId)
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight
    const BUBBLE_HEIGHT = 160
    const GAP = 12

    if (rect.top >= BUBBLE_HEIGHT + GAP) {
      setBubblePos({ top: 0, bottom: vh - rect.top + GAP, useBottom: true })
    } else {
      setBubblePos({ top: rect.bottom + GAP, bottom: 0, useBottom: false })
    }
  }, [showTour, tourStep])

  useEffect(() => {
    if (!showTour) return
    const step = TOUR_STEPS[tourStep]
    if (!step) return
    const el = document.getElementById(step.fieldId)
    if (!el) return

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    measureBubble()
    const t1 = setTimeout(measureBubble, 400)
    const t2 = setTimeout(measureBubble, 700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [tourStep, showTour, measureBubble])

  useEffect(() => {
    if (!showTour) return
    window.addEventListener('resize', measureBubble)
    window.addEventListener('scroll', measureBubble, { passive: true })
    return () => {
      window.removeEventListener('resize', measureBubble)
      window.removeEventListener('scroll', measureBubble)
    }
  }, [showTour, measureBubble])

  const startTour = () => {
    tourStarted.current = true
    setTourStep(0)
    setShowTour(true)
  }

  const nextTourStep = () => {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(prev => prev + 1)
    } else {
      setShowTour(false)
    }
  }

  const closeTour = () => { setShowTour(false); setBubblePos(null) }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  // For choice-button fields
  const handleChoiceChange = (field: string) => (val: string) => {
    setFormData(prev => ({ ...prev, [field]: prev[field as keyof typeof prev] === val ? '' : val }))
  }
  async function notifyRegistrationComplete(lineUserId: string, data: typeof formData) {
  const N8N_WEBHOOK_URL = 'https://prorate-squeak-perennial.ngrok-free.dev/webhook/registration-complete' // เปลี่ยนเป็น URL จริงจาก n8n
  const SECRET = 'dwa-secret-2024' // ต้องตรงกับ secret ที่ฝังใน node "Validate & Extract Data"

  try {
    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-registration-secret': SECRET },
      body: JSON.stringify({
        userId: lineUserId,
        name: data.fullName,
        phone: data.phoneNumber,
        email: '',
      }),
    })
  } catch (err) {
    // webhook fail ไม่กระทบการลงทะเบียนหลัก
    console.error('Webhook notification failed:', err)
  }
}
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!formData.lineUserId || !formData.fullName || !formData.phoneNumber || !formData.gender || !formData.ageRange || !formData.pdpaConsent) {
      setError('กรุณากรอกข้อมูลที่จำเป็นทั้งหมด')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: formData.lineUserId,
          userId: formData.userId,
          pdpaConsent: formData.pdpaConsent ? 'ยอมรับ' : 'ไม่ยอมรับ',
          fullName: formData.fullName,
          phoneNumber: formData.phoneNumber,
          gender: formData.gender,
          ageRange: formData.ageRange,
          userType: formData.userType,
          subdistrict: formData.subdistrict,
          occupation: formData.occupation,
          // houseNumber intentionally excluded — mock only
          registrationDate: new Date().toLocaleDateString('th-TH'),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to register')
      }

      if (formData.lineUserId) {
        await notifyRegistrationComplete(formData.lineUserId, formData)
      }

      setSuccess(true)
      
      setFormData({
        lineUserId: '', userId: '', pdpaConsent: false, fullName: '',
        phoneNumber: '', gender: '', ageRange: '', userType: '', subdistrict: '', occupation: '',
        houseNumber: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลงทะเบียน')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (fieldId: string) =>
    `w-full px-4 py-3 rounded-lg border bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#154212] focus:border-transparent outline-none transition-all ${
      showTour && TOUR_STEPS[tourStep]?.fieldId === fieldId
        ? 'border-[#154212]'
        : 'border-[#e5e5e5]'
    }`

  const fieldWrapClass = (fieldId: string) =>
    showTour && TOUR_STEPS[tourStep]?.fieldId === fieldId
      ? 'relative z-[60] rounded-xl ring-4 ring-[#154212]/40 bg-white p-1'
      : ''

  const isLocalResident = formData.userType === 'คนในชุมชนคุ้งบางกะเจ้า'

  if (success) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <PageHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md w-full">
            <div className="w-16 h-16 bg-[#154212] rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#154212] mb-3">ลงทะเบียนสำเร็จ</h2>
            <p className="text-gray-600 mb-2">ยินดีต้อนรับสู่ Digital Wasted Account</p>
            <p className="text-sm text-gray-500 mb-6">คุณได้ลงทะเบียนเรียบร้อยแล้ว</p>
            <Link
              href="/"
              className="inline-block bg-[#154212] text-white font-bold py-3 px-8 rounded-lg hover:bg-[#0d3308] transition-colors"
            >
              กลับไปหน้าหลัก
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      {/* Tour overlay */}
      {showTour && (
        <div
          className="fixed inset-0 z-50 pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        />
      )}

      {/* Tour bubble */}
      {showTour && bubblePos && (
        <div
          className="fixed z-[70] pointer-events-auto"
          style={
            bubblePos.useBottom
              ? { bottom: bubblePos.bottom, left: '50%', transform: 'translateX(-50%)', maxWidth: 320, width: 'calc(100vw - 32px)' }
              : { top: bubblePos.top, left: '50%', transform: 'translateX(-50%)', maxWidth: 320, width: 'calc(100vw - 32px)' }
          }
        >
          <div className="bg-white rounded-2xl shadow-2xl p-4 relative">
            {bubblePos.useBottom ? (
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0"
                style={{ borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '12px solid white' }}
              />
            ) : (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0"
                style={{ borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderBottom: '12px solid white' }}
              />
            )}
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-14 h-14 relative">
                <Image src="/mascot.png" alt="mascot" fill className="object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#154212] mb-1">
                  {TOUR_STEPS[tourStep].title}
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {TOUR_STEPS[tourStep].message}
                </p>
              </div>
              <button onClick={closeTour} className="shrink-0 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-gray-400">
                {tourStep + 1} / {TOUR_STEPS.length}
              </span>
              <button
                onClick={nextTourStep}
                className="px-4 py-1.5 bg-[#154212] text-white text-xs font-semibold rounded-full hover:bg-[#0d3308] transition-colors"
              >
                {tourStep < TOUR_STEPS.length - 1 ? 'ถัดไป' : 'เสร็จแล้ว!'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mascot guide button */}
      {!showTour && (
        <button
          type="button"
          onClick={startTour}
          className="fixed bottom-6 right-4 z-40 flex flex-col items-center gap-1 group"
          aria-label="เปิดคู่มือการลงทะเบียน"
        >
          <div className="relative w-16 h-16 drop-shadow-lg">
            <Image src="/mascot.png" alt="ผู้ช่วยลงทะเบียน" fill className="object-contain" />
          </div>
          <span className="text-[13px] bg-[#154212] text-white font-medium px-2 py-0.5 rounded-full shadow whitespace-nowrap">
            มาครั้งแรก?
          </span>
        </button>
      )}

      {/* Form */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#154212] mb-1">ลงทะเบียน</h1>
          <p className="text-gray-500 text-sm">กรุณากรอกข้อมูลของคุณให้ครบถ้วน</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* ── 1. ประเภทผู้ใช้งาน ── */}
          <div id="field-userType" className={fieldWrapClass('field-userType')}>
            <label className="block text-gray-700 font-semibold mb-2 text-sm">
              ประเภทผู้ใช้งาน
            </label>
            <ChoiceGroup
              options={USER_TYPES}
              value={formData.userType}
              onChange={handleChoiceChange('userType')}
              highlighted={showTour && TOUR_STEPS[tourStep]?.fieldId === 'field-userType'}
            />
          </div>

          {/* ── 2. ชื่อ-นามสกุล ── */}
          <div id="field-fullName" className={fieldWrapClass('field-fullName')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">ชื่อ-นามสกุล *</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="เช่น นายสมหวัง ใจดี"
              className={inputClass('field-fullName')}
              required
            />
          </div>

          {/* ── 3. เพศ ── */}
          <div id="field-gender" className={fieldWrapClass('field-gender')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">เพศ *</label>
            <ChoiceGroup
              options={GENDERS}
              value={formData.gender}
              onChange={handleChoiceChange('gender')}
              highlighted={showTour && TOUR_STEPS[tourStep]?.fieldId === 'field-gender'}
            />
          </div>

          {/* ── 4. ช่วงอายุ ── */}
          <div id="field-ageRange" className={fieldWrapClass('field-ageRange')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">ช่วงอายุ *</label>
            <ChoiceGroup
              options={AGE_RANGES}
              value={formData.ageRange}
              onChange={handleChoiceChange('ageRange')}
              highlighted={showTour && TOUR_STEPS[tourStep]?.fieldId === 'field-ageRange'}
            />
          </div>

          {/* ── 5. เบอร์โทรศัพท์ ── */}
          <div id="field-phoneNumber" className={fieldWrapClass('field-phoneNumber')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">เบอร์โทรศัพท์ *</label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="เช่น 0812345678"
              className={inputClass('field-phoneNumber')}
              required
            />
          </div>

          {/* ── 6. อาชีพ ── */}
          <div id="field-occupation" className={fieldWrapClass('field-occupation')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">อาชีพปัจจุบัน / อดีต</label>
            <ChoiceGroup
              options={OCCUPATIONS}
              value={formData.occupation}
              onChange={handleChoiceChange('occupation')}
              highlighted={showTour && TOUR_STEPS[tourStep]?.fieldId === 'field-occupation'}
            />
          </div>

          {/* ── 7. ที่อยู่ (conditional — เฉพาะคนในชุมชน) ── */}
          {isLocalResident && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-2 text-sm">บ้านเลขที่</label>
                  <input
                    type="text"
                    name="houseNumber"
                    value={formData.houseNumber}
                    onChange={handleChange}
                    placeholder="เช่น 12/3"
                    className="w-full px-4 py-3 rounded-lg border border-[#e5e5e5] bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#154212] focus:border-transparent outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2 text-sm">หมู่ที่</label>
                  <input
                    type="text"
                    name="mooNumber"
                    placeholder="เช่น 4"
                    className="w-full px-4 py-3 rounded-lg border border-[#e5e5e5] bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#154212] focus:border-transparent outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div id="field-subdistrict" className={fieldWrapClass('field-subdistrict')}>
                <label className="block text-gray-700 font-medium mb-2 text-sm">พื้นที่ 6 ตำบลหลัก</label>
                <ChoiceGroup
                  options={SUBDISTRICTS}
                  value={formData.subdistrict}
                  onChange={handleChoiceChange('subdistrict')}
                  highlighted={showTour && TOUR_STEPS[tourStep]?.fieldId === 'field-subdistrict'}
                />
              </div>
            </>
          )}

          {/* ── PDPA (อยู่ล่างสุด) ── */}
          <div className={`rounded-xl border transition-colors ${formData.pdpaConsent ? 'border-[#154212] bg-[#f0fdf0]' : 'border-[#e5e5e5] bg-[#f9f9f9]'}`}>
            <label className="flex items-start gap-3 cursor-pointer p-4">
              <input
                type="checkbox"
                name="pdpaConsent"
                checked={formData.pdpaConsent}
                onChange={handleChange}
                className="mt-0.5 w-5 h-5 shrink-0 rounded border-gray-300 text-[#154212] accent-[#154212]"
                required
              />
              <span className="text-gray-800 text-sm leading-relaxed font-medium">
                ฉันยอมรับนโยบายการคุ้มครองข้อมูลส่วนบุคคล (PDPA) *
              </span>
            </label>
            <button
              type="button"
              onClick={() => setPdpaExpanded(prev => !prev)}
              className="w-full flex items-center justify-center gap-1 px-4 pb-3 text-xs text-[#154212] font-medium hover:underline"
            >
              {pdpaExpanded ? (
                <><ChevronUp className="w-3.5 h-3.5" /> ซ่อนรายละเอียด</>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5" /> อ่านรายละเอียดเพิ่มเติม</>
              )}
            </button>
            {pdpaExpanded && (
              <div className="px-4 pb-4">
                <div className="bg-white rounded-lg border border-[#e5e5e5] p-3 max-h-48 overflow-y-auto">
                  <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">
                    {PDPA_TEXT}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#154212] text-white font-bold py-3 rounded-lg hover:bg-[#0d3308] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'กำลังลงทะเบียน...' : 'ลงทะเบียน'}
          </button>
        </form>
      </div>
    </div>
  )
}
