'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { useLiffContext } from '@/lib/liff-context'
import { generateUserIdFromLineId } from '@/lib/user-id-generator'

const OCCUPATIONS = [
  'ผู้ใช้งานกรอกอาชีพตนเอง',
  'ผู้ประกอบการ (ร้านค้า/โฮมสเตย์)',
  'เกษตรกร',
  'ข้าราชการ/พนักงานของรัฐ',
  'พนักงานบริษัทเอกชน',
  'รับจ้างทั่วไป',
  'นักเรียน/นักศึกษา',
  'ผู้เกษียณอายุ/ว่างงาน',
  'อื่นๆ (ไม่ต้องระบุ)',
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
    fieldId: 'field-fullName',
    title: 'ชื่อ-นามสกุล',
    message: 'เริ่มต้นด้วยการกรอกชื่อและนามสกุลของคุณครับ ใส่ชื่อจริงเพื่อให้เจ้าหน้าที่ติดต่อได้นะครับ',
  },
  {
    fieldId: 'field-phoneNumber',
    title: 'เบอร์ติดต่อ',
    message: 'กรอกเบอร์โทรศัพท์ที่ติดต่อได้ครับ เจ้าหน้าที่จะใช้เบอร์นี้ในการประสานงานกับคุณ',
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
    fieldId: 'field-userType',
    title: 'ประเภทผู้ใช้งาน',
    message: 'คุณเป็นคนในชุมชนคุ้งบางกะเจ้าหรือนักท่องเที่ยวครับ? เลือกให้ตรงกับสถานะของคุณเลย',
  },
  {
    fieldId: 'field-subdistrict',
    title: 'ตำบล',
    message: 'เลือกตำบลที่คุณอาศัยอยู่ครับ ถ้าไม่ได้อยู่ในรายการก็เลือก "อื่นๆ" ได้เลยครับ',
  },
  {
    fieldId: 'field-occupation',
    title: 'อาชีพ',
    message: 'ฟิลด์สุดท้ายแล้วครับ! เลือกอาชีพที่ตรงกับคุณ แล้วกด "ลงทะเบียน" ได้เลยครับ',
  },
]

const PDPA_TEXT = `นโยบายการคุ้มครองข้อมูลส่วนบุคคล (PDPA)

โครงการ Digital Wasted Account ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของท่าน ข้อมูลที่เก็บรวบรวม ได้แก่ ชื่อ-นามสกุล เบอร์ติดต่อ เพศ ช่วงอายุ ตำบลที่อยู่อาศัย และอาชีพ

วัตถุประสงค์การใช้ข้อมูล
- เพื่อจัดการและติดตามข้อมูลขยะในชุมชนคุ้งบางกะเจ้า
- เพื่อประสานงานกับเจ้าหน้าที่เก็บขยะ
- เพื่อวิเคราะห์สถิติการลดขยะและคาร์บอนในชุมชน

ข้อมูลของท่านจะถูกเก็บรักษาอย่างปลอดภัยและจะไม่ถูกเปิดเผยต่อบุคคลภายนอกโดยไม่ได้รับความยินยอม ท่านมีสิทธิ์ขอดู แก้ไข หรือลบข้อมูลของตนเองได้ตลอดเวลา`

export default function RegisterPage() {
  const { profile } = useLiffContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pdpaExpanded, setPdpaExpanded] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [tourStep, setTourStep] = useState(0)
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)
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

  // Update highlight rect whenever tour step changes
  useEffect(() => {
    if (!showTour) return
    const step = TOUR_STEPS[tourStep]
    if (!step) return
    const el = document.getElementById(step.fieldId)
    if (el) {
      const rect = el.getBoundingClientRect()
      setHighlightRect(rect)
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Re-measure after scroll settles
      const timeout = setTimeout(() => {
        const updated = el.getBoundingClientRect()
        setHighlightRect(updated)
      }, 400)
      return () => clearTimeout(timeout)
    }
  }, [tourStep, showTour])

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

  const closeTour = () => setShowTour(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
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
          registrationDate: new Date().toLocaleDateString('th-TH'),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to register')
      }

      setSuccess(true)
      setFormData({
        lineUserId: '', userId: '', pdpaConsent: false, fullName: '',
        phoneNumber: '', gender: '', ageRange: '', userType: '', subdistrict: '', occupation: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลงทะเบียน')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (fieldId: string) =>
    `w-full px-4 py-3 rounded-lg border bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#154212] focus:border-transparent outline-none transition-colors ${
      showTour && TOUR_STEPS[tourStep]?.fieldId === fieldId
        ? 'border-[#154212] ring-2 ring-[#154212] relative z-[60]'
        : 'border-[#e5e5e5]'
    }`

  const fieldWrapClass = (fieldId: string) =>
    showTour && TOUR_STEPS[tourStep]?.fieldId === fieldId ? 'relative z-[60]' : ''

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

      {/* Tour overlay — dark backdrop with cutout effect via box-shadow */}
      {showTour && (
        <div
          className="fixed inset-0 z-50 pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        />
      )}

      {/* Tour bubble — rendered fixed, positioned near highlighted field */}
      {showTour && highlightRect && (
        <div
          className="fixed z-[70] pointer-events-auto"
          style={{
            bottom: `calc(100vh - ${highlightRect.top + window.scrollY}px + 16px)`,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '320px',
            width: 'calc(100vw - 32px)',
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-4 relative">
            {/* Arrow pointing down toward the field */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0"
              style={{ borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '12px solid white' }}
            />
            <div className="flex items-start gap-3">
              {/* Mascot */}
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

      {/* Form */}
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header + mascot guide trigger */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#154212] mb-1">ลงทะเบียน</h1>
            <p className="text-gray-500 text-sm">กรุณากรอกข้อมูลของคุณให้ครบถ้วน</p>
          </div>
          {/* Mascot guide button */}
          <button
            type="button"
            onClick={startTour}
            className="flex flex-col items-center gap-1 group"
            aria-label="เปิดคู่มือการลงทะเบียน"
          >
            <div className="relative w-14 h-14">
              <Image src="/mascot.png" alt="ผู้ช่วยลงทะเบียน" fill className="object-contain" />
            </div>
            <span className="text-[10px] text-[#154212] font-medium whitespace-nowrap">
              มาครั้งแรก?
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* PDPA — moved to top */}
          <div className={`rounded-xl border transition-colors ${formData.pdpaConsent ? 'border-[#154212] bg-[#f0fdf0]' : 'border-[#e5e5e5] bg-[#f9f9f9]'}`}>
            {/* Checkbox row */}
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
            {/* Expand toggle */}
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

          {/* LINE User ID */}
          <div>
            <label className="block text-gray-700 font-medium mb-2 text-sm">LINE User ID</label>
            <input
              type="text"
              name="lineUserId"
              value={formData.lineUserId}
              readOnly
              className="w-full px-4 py-3 rounded-lg border border-[#e5e5e5] bg-gray-100 text-gray-500 outline-none cursor-not-allowed text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">ดึงมาจากบัญชี LINE โดยอัตโนมัติ</p>
          </div>

          {/* User ID */}
          <div>
            <label className="block text-gray-700 font-medium mb-2 text-sm">User ID</label>
            <input
              type="text"
              name="userId"
              value={formData.userId}
              readOnly
              className="w-full px-4 py-3 rounded-lg border border-[#e5e5e5] bg-gray-100 text-gray-500 outline-none cursor-not-allowed text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">สร้างขึ้นโดยอัตโนมัติจากบัญชี LINE</p>
          </div>

          {/* Full Name */}
          <div id="field-fullName" className={fieldWrapClass('field-fullName')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">ชื่อ-นามสกุล *</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="เช่น สมชาย สมการ"
              className={inputClass('field-fullName')}
              required
            />
          </div>

          {/* Phone Number */}
          <div id="field-phoneNumber" className={fieldWrapClass('field-phoneNumber')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">เบอร์ติดต่อ *</label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="เช่น 08xxxxxxxx"
              className={inputClass('field-phoneNumber')}
              required
            />
          </div>

          {/* Gender */}
          <div id="field-gender" className={fieldWrapClass('field-gender')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">เพศ *</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className={inputClass('field-gender')}
              required
            >
              <option value="">-- เลือกเพศ --</option>
              {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* Age Range */}
          <div id="field-ageRange" className={fieldWrapClass('field-ageRange')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">ช่วงอายุ *</label>
            <select
              name="ageRange"
              value={formData.ageRange}
              onChange={handleChange}
              className={inputClass('field-ageRange')}
              required
            >
              <option value="">-- เลือกช่วงอายุ --</option>
              {AGE_RANGES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* User Type */}
          <div id="field-userType" className={fieldWrapClass('field-userType')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">ประเภทผู้ใช้งาน</label>
            <select
              name="userType"
              value={formData.userType}
              onChange={handleChange}
              className={inputClass('field-userType')}
            >
              <option value="">-- เลือกประเภท --</option>
              {USER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Subdistrict */}
          <div id="field-subdistrict" className={fieldWrapClass('field-subdistrict')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">ตำบล</label>
            <select
              name="subdistrict"
              value={formData.subdistrict}
              onChange={handleChange}
              className={inputClass('field-subdistrict')}
            >
              <option value="">-- เลือกตำบล --</option>
              {SUBDISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Occupation */}
          <div id="field-occupation" className={fieldWrapClass('field-occupation')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">อาชีพ</label>
            <select
              name="occupation"
              value={formData.occupation}
              onChange={handleChange}
              className={inputClass('field-occupation')}
            >
              <option value="">-- เลือกอาชีพ --</option>
              {OCCUPATIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#154212] text-white font-bold py-3 rounded-lg hover:bg-[#0d3308] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? 'กำลังลงทะเบียน...' : 'ลงทะเบียน'}
          </button>
        </form>
      </div>
    </div>
  )
}
