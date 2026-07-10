'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import liff from '@line/liff'
import Image from 'next/image'
import { ChevronDown, ChevronUp, X, ArrowLeft } from 'lucide-react'
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
    fieldId: 'field-firstName',
    title: 'ชื่อ',
    message: 'กรอกชื่อของท่านครับ',
  },
  {
    fieldId: 'field-nickname',
    title: 'ชื่อเล่น',
    message: 'ชื่อเล่นดึงมาจาก LINE อัตโนมัติครับ สามารถแก้ไขได้ตามต้องการ',
  },
  {
    fieldId: 'field-phoneNumber',
    title: 'เบอร์ติดต่อ',
    message: 'กรอกเบอร์โทรศัพท์ที่ติดต่อได้ครับ เจ้าหน้าที่จะใช้เบอร์นี้เมื่อจำเป็นต้องติดต่อกับท่าน',
  },
  {
    fieldId: 'field-address',
    title: 'ที่อยู่',
    message: 'กรอกที่อยู่ของท่านครับ เช่น บ้านเลขที่ ถนน หมู่บ้าน',
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

// Reusable native select dropdown
function SelectField({
  options,
  value,
  onChange,
  placeholder,
  highlighted = false,
}: {
  options: string[]
  value: string
  onChange: (val: string) => void
  placeholder: string
  highlighted?: boolean
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-4 py-3 pr-10 rounded-lg border bg-white text-gray-900 focus:ring-2 focus:ring-[#154212] focus:border-transparent outline-none transition-all appearance-none ${
          !value ? 'text-gray-400' : 'text-gray-900'
        } ${highlighted ? 'border-[#154212]' : 'border-[#e5e5e5]'}`}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    </div>
  )
}

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

function RegisterPageContent() {
  const { profile, isReady } = useLiffContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pdpaExpanded, setPdpaExpanded] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [tourStep, setTourStep] = useState(0)
  const [bubblePos, setBubblePos] = useState<{ top: number; bottom: number; useBottom: boolean } | null>(null)
  const tourStarted = useRef(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isEditMode = searchParams.get('mode') === 'edit'

  // After registration/update: close the LIFF window or go back to profile.
  const handleFinish = () => {
    if (isEditMode) {
      // Return to the profile we came from, keeping its history/back state.
      if (window.history.length > 1) {
        router.back()
      } else {
        router.push('/profile')
      }
      return
    }
    if (liff.isInClient()) {
      liff.closeWindow()
    } else {
      router.push('/home')
    }
  }

  const [formData, setFormData] = useState({
    lineUserId: '',
    userId: '',
    pdpaConsent: false,
    firstName: '',
    lastName: '',
    nickname: '',
    phoneNumber: '',
    address: '',
    gender: '',
    ageRange: '',
    userType: '',
    subdistrict: '',
    occupation: '',
    houseNumber: '',
  })

  useEffect(() => {
    if (profile?.userId) {
      const generatedUserId = generateUserIdFromLineId(profile.userId)
      setFormData(prev => ({
        ...prev,
        lineUserId: profile.userId,
        userId: generatedUserId,
        nickname: prev.nickname || profile.displayName || '',
      }))
    }
  }, [profile])

  // In edit mode: fetch existing profile data and pre-fill the form
  useEffect(() => {
    if (!isEditMode || !profile?.userId) return
    fetch(`/api/profile/${encodeURIComponent(profile.userId)}`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return
        const [firstName = '', ...rest] = (data.name || '').split(' ')
        const lastName = rest.join(' ')
        setFormData(prev => ({
          ...prev,
          firstName: firstName || prev.firstName,
          lastName: lastName || prev.lastName,
          nickname: data.displayName || prev.nickname,
          phoneNumber: data.phoneNumber || prev.phoneNumber,
          gender: data.gender || prev.gender,
          ageRange: data.age || prev.ageRange,
          userType: data.type || prev.userType,
          subdistrict: data.subdistrict || prev.subdistrict,
          occupation: data.occupation || prev.occupation,
          address: data.address || prev.address,
          pdpaConsent: true,
        }))
      })
      .catch(() => {/* silently ignore */})
  }, [isEditMode, profile?.userId])

  // นักท่องเที่ยว don't have the ที่อยู่ / ตำบล fields, so the guided tour must
  // skip those steps — otherwise น้องรัก points at fields that aren't rendered.
  const visibleTourSteps = useMemo(
    () =>
      TOUR_STEPS.filter(step =>
        formData.userType === 'นักท่องเที่ยว'
          ? step.fieldId !== 'field-address' && step.fieldId !== 'field-subdistrict'
          : true
      ),
    [formData.userType]
  )

  // Keep the step index in range if the visible steps shrink (e.g. user switches
  // to นักท่องเที่ยว partway through the tour).
  useEffect(() => {
    if (tourStep > visibleTourSteps.length - 1) {
      setTourStep(Math.max(0, visibleTourSteps.length - 1))
    }
  }, [visibleTourSteps.length, tourStep])

  const measureBubble = useCallback(() => {
    if (!showTour) return
    const step = visibleTourSteps[tourStep]
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
  }, [showTour, tourStep, visibleTourSteps])

  useEffect(() => {
    if (!showTour) return
    const step = visibleTourSteps[tourStep]
    if (!step) return
    const el = document.getElementById(step.fieldId)
    if (!el) return

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    measureBubble()
    const t1 = setTimeout(measureBubble, 400)
    const t2 = setTimeout(measureBubble, 700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [tourStep, showTour, measureBubble, visibleTourSteps])

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
    if (tourStep < visibleTourSteps.length - 1) {
      setTourStep(prev => prev + 1)
    } else {
      setShowTour(false)
    }
  }

  const closeTour = () => { setShowTour(false); setBubblePos(null) }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  // For choice-button fields
  const handleChoiceChange = (field: string) => (val: string) => {
    setFormData(prev => {
      const nextVal = prev[field as keyof typeof prev] === val ? '' : val
      const updated = { ...prev, [field]: nextVal }
      // Switching to นักท่องเที่ยว hides the ที่อยู่ / ตำบล fields — clear them
      // so we never submit stale resident-only data.
      if (field === 'userType' && nextVal === 'นักท่องเที่ยว') {
        updated.address = ''
        updated.subdistrict = ''
      }
      return updated
    })
  }

  // Ordered list of required fields (top→bottom, matching the form layout) with
  // whether each is filled. Drives the grey submit button and the scroll-to-first
  // -missing behaviour. ตำบล/อาชีพ are required only for non-tourists; the phone
  // number must be a full 10 digits.
  const getRequiredFields = (): { id: string; ok: boolean; label: string }[] => {
    const isTourist = formData.userType === 'นักท่องเที่ยว'
    const isLocal = formData.userType === 'คนในชุมชนคุ้งบางกะเจ้า'
    const fields: { id: string; ok: boolean; label: string }[] = [
      { id: 'field-userType', ok: Boolean(formData.userType), label: 'ประเภทผู้ใช้งาน' },
      { id: 'field-firstName', ok: Boolean(formData.firstName.trim()), label: 'ชื่อ' },
      { id: 'field-lastName', ok: Boolean(formData.lastName.trim()), label: 'นามสกุล' },
      { id: 'field-phoneNumber', ok: formData.phoneNumber.length === 10, label: 'เบอร์โทรศัพท์' },
    ]
    if (isLocal) fields.push({ id: 'field-address', ok: Boolean(formData.address.trim()), label: 'ที่อยู่' })
    fields.push({ id: 'field-gender', ok: Boolean(formData.gender), label: 'เพศ' })
    fields.push({ id: 'field-ageRange', ok: Boolean(formData.ageRange), label: 'ช่วงอายุ' })
    if (isLocal) fields.push({ id: 'field-subdistrict', ok: Boolean(formData.subdistrict), label: 'พื้นที่ 6 ตำบลหลัก' })
    if (!isTourist) fields.push({ id: 'field-occupation', ok: Boolean(formData.occupation), label: 'อาชีพปัจจุบัน / อดีต' })
    fields.push({ id: 'field-pdpa', ok: formData.pdpaConsent, label: 'ยอมรับนโยบาย PDPA' })
    return fields
  }

  // Scroll the given field into view and focus its first control (if any).
  const scrollToField = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const focusable = el.querySelector<HTMLElement>('input, select, textarea')
    if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 300)
  }

  async function notifyRegistrationComplete(lineUserId: string, data: typeof formData) {
  // ✅ 1. URL ของ GAS web app + route=register
  const GAS_WEBHOOK_URL =
    'https://script.google.com/macros/s/AKfycbzdx4g2pYQ6AerMtgsS-DQKh-yPnVeCGkVjVKA3TjabHHI8JUn2x4_pjXqP26EBwsH0/exec?route=register'
  const SECRET = 'dwa-secret-2024'
  const fullName = `${data.firstName} ${data.lastName}`.trim()
  try {
    await fetch(GAS_WEBHOOK_URL, {
      method: 'POST',
      // ✅ 3. text/plain เลี่ยง CORS preflight (เอา x-registration-secret ออก)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        secret: SECRET,          // ✅ 2. ย้าย secret มาไว้ใน body
        lineUserId: data.lineUserId,
        userId: data.userId,
        pdpaConsent: data.pdpaConsent ? 'ยอมรับ' : 'ไม่ยอมรับ',
        fullName,
        nickname: data.nickname,
        phoneNumber: data.phoneNumber,
        address: data.address,
        gender: data.gender,
        ageRange: data.ageRange,
        userType: data.userType,
        subdistrict: data.subdistrict,
        occupation: data.occupation,
        registrationDate: new Date().toLocaleDateString('th-TH'),
      }),
    })
  } catch (err) {
    console.error('Webhook notification failed:', err)
  }
}

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!formData.lineUserId) {
      setError('ไม่พบข้อมูลผู้ใช้ LINE กรุณาเปิดหน้านี้ผ่าน LINE อีกครั้ง')
      return
    }

    // Grey-button flow: guide the user through one field at a time, top-down —
    // jump to the first missing field and mention only that one, so it isn't
    // overwhelming (especially for elderly users).
    const firstMissing = getRequiredFields().find(f => !f.ok)
    if (firstMissing) {
      scrollToField(firstMissing.id)
      const label =
        // Phone that's started but under 10 digits gets a clearer note.
        firstMissing.id === 'field-phoneNumber' && formData.phoneNumber.length > 0
          ? 'เบอร์โทรศัพท์ (ต้องมี 10 หลัก)'
          : firstMissing.label
      setError(`กรุณากรอก "${label}" ครับ`)
      return
    }

    setLoading(true)
    const fullName = `${formData.firstName} ${formData.lastName}`.trim()

    // นักท่องเที่ยว have no ที่อยู่ / ตำบล. Force these empty in the payload so the
    // database is overwritten with blanks — even in edit mode where a former
    // resident's old values could still be sitting in formData.
    const isTouristUser = formData.userType === 'นักท่องเที่ยว'

    try {
      const requestBody = {
        lineUserId: formData.lineUserId,
        userId: formData.userId,
        pdpaConsent: formData.pdpaConsent ? 'ยอมรับ' : 'ไม่ยอมรับ',
        fullName,
        nickname: formData.nickname,
        phoneNumber: formData.phoneNumber,
        address: isTouristUser ? '' : formData.address,
        gender: formData.gender,
        ageRange: formData.ageRange,
        userType: formData.userType,
        subdistrict: isTouristUser ? '' : formData.subdistrict,
        occupation: formData.occupation,
        registrationDate: new Date().toLocaleDateString('th-TH'),
      }

      const response = await fetch('/api/register', {
        method: isEditMode ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || (isEditMode ? 'Failed to update' : 'Failed to register'))
      }

      // Only greet on first-time registration — editing an existing profile
      // must not trigger the "thanks for registering" LINE OA message.
      if (!isEditMode && formData.lineUserId) {
        await notifyRegistrationComplete(formData.lineUserId, formData)
      }

      setSuccess(true)
      localStorage.setItem('is_registered', 'true');

      setFormData({
        lineUserId: '', userId: '', pdpaConsent: false, firstName: '', lastName: '',
        nickname: '', phoneNumber: '', address: '', gender: '', ageRange: '',
        userType: '', subdistrict: '', occupation: '', houseNumber: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลงทะเบียน')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (fieldId: string) =>
    `w-full px-4 py-3 rounded-lg border bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#154212] focus:border-transparent outline-none transition-all ${
      showTour && visibleTourSteps[tourStep]?.fieldId === fieldId
        ? 'border-[#154212]'
        : 'border-[#e5e5e5]'
    }`

  const fieldWrapClass = (fieldId: string) =>
    showTour && visibleTourSteps[tourStep]?.fieldId === fieldId
      ? 'relative z-[60] rounded-xl ring-4 ring-[#154212]/40 bg-white p-1'
      : ''

  const isLocalResident = formData.userType === 'คนในชุมชนคุ้งบางกะเจ้า'
  const isTourist = formData.userType === 'นักท่องเที่ยว'
  const isFormComplete = getRequiredFields().every(f => f.ok)

  if (!isReady) return null

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
            <h2 className="text-2xl font-bold text-[#154212] mb-3">
              {isEditMode ? 'อัพเดตข้อมูลสำเร็จ' : 'ลงทะเบียนสำเร็จ'}
            </h2>
            <p className="text-gray-600 mb-2">
              {isEditMode ? 'ข้อมูลของคุณได้รับการอัพเดตแล้ว' : 'ยินดีต้อนรับสู่ Digital Wasted Account'}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              {isEditMode ? '' : 'คุณได้ลงทะเบียนเรียบร้อยแล้ว'}
            </p>
            <button
              onClick={handleFinish}
              className="inline-block bg-[#154212] text-white font-bold py-3 px-8 rounded-lg hover:bg-[#0d3308] transition-colors"
            >
              {isEditMode ? 'กลับสู่โปรไฟล์' : 'กลับสู่ line'}
            </button>
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
                  {visibleTourSteps[tourStep]?.title}
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {visibleTourSteps[tourStep]?.message}
                </p>
              </div>
              <button onClick={closeTour} className="shrink-0 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-gray-400">
                {tourStep + 1} / {visibleTourSteps.length}
              </span>
              <button
                onClick={nextTourStep}
                className="px-4 py-1.5 bg-[#154212] text-white text-xs font-semibold rounded-full hover:bg-[#0d3308] transition-colors"
              >
                {tourStep < visibleTourSteps.length - 1 ? 'ถัดไป' : 'เสร็จแล้ว!'}
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
        {/* Cancel edit — return to the profile we came from without saving.
            Prefer history back so we land on the same profile entry (keeping
            its state/back button); fall back to a push if edit was opened
            directly with no history to return to. */}
        {isEditMode && (
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back()
              } else {
                router.push('/profile')
              }
            }}
            className="flex items-center gap-1 text-[#154212] hover:text-[#154212]/70 transition-colors mb-4"
            aria-label="กลับไปหน้าโปรไฟล์"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">กลับ</span>
          </button>
        )}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#154212] mb-1">
            {isEditMode ? 'แก้ไขข้อมูล' : 'ลงทะเบียน'}
          </h1>
          <p className="text-gray-500 text-sm">
            {isEditMode ? 'แก้ไขข้อมูลของคุณแล้วกดบันทึก' : 'กรุณากรอกข้อมูลของคุณให้ครบถ้วน'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── 1. ประเภทผู้ใช้งาน ── */}
          <div id="field-userType" className={fieldWrapClass('field-userType')}>
            <label className="block text-gray-700 font-semibold mb-2 text-sm">
              ประเภทผู้ใช้งาน
            </label>
            <ChoiceGroup
              options={USER_TYPES}
              value={formData.userType}
              onChange={handleChoiceChange('userType')}
              highlighted={showTour && visibleTourSteps[tourStep]?.fieldId === 'field-userType'}
            />
          </div>

          {/* ── 2. ชื่อ + นามสกุล (แยกสองบล็อก) ── */}
          <div className="grid grid-cols-2 gap-3">
            <div id="field-firstName" className={fieldWrapClass('field-firstName')}>
              <label className="block text-gray-700 font-medium mb-2 text-sm">ชื่อ *</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="เช่น สมหวัง"
                className={inputClass('field-firstName')}
              />
            </div>
            <div id="field-lastName">
              <label className="block text-gray-700 font-medium mb-2 text-sm">นามสกุล *</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="เช่น ใจดี"
                className="w-full px-4 py-3 rounded-lg border border-[#e5e5e5] bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#154212] focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          {/* ── 3. ชื่อเล่น (default จาก LINE displayName) ── */}
          <div id="field-nickname" className={fieldWrapClass('field-nickname')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">
              ชื่อเล่น
              <span className="ml-2 text-xs font-normal text-[#154212] bg-[#e8f5e2] px-2 py-0.5 rounded-full">
                ดึงจาก LINE อัตโนมัติ
              </span>
            </label>
            <input
              type="text"
              name="nickname"
              value={formData.nickname}
              onChange={handleChange}
              placeholder="ชื่อเล่น"
              className={inputClass('field-nickname')}
            />
          </div>

          {/* ── 4. เบอร์โทรศัพท์ ── */}
          <div id="field-phoneNumber" className={fieldWrapClass('field-phoneNumber')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">เบอร์โทรศัพท์ *</label>
            <input
              type="tel"
              name="phoneNumber"
              inputMode="numeric"
              value={formData.phoneNumber}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                setFormData(prev => ({ ...prev, phoneNumber: digits }))
              }}
              placeholder="เช่น 0812345678"
              maxLength={10}
              className={inputClass('field-phoneNumber')}
            />
            {formData.phoneNumber.length > 0 && formData.phoneNumber.length < 10 && (
              <p className="mt-1.5 text-xs text-red-500">
                เบอร์โทรศัพท์ต้องมี 10 หลัก (ตอนนี้ {formData.phoneNumber.length} หลัก)
              </p>
            )}
          </div>

          {/* ── 5. ที่อยู่ (บังคับ — ซ่อนสำหรับนักท่องเที่ยว) ── */}
          {isLocalResident && (
            <div id="field-address" className={fieldWrapClass('field-address')}>
              <label className="block text-gray-700 font-medium mb-2 text-sm">ที่อยู่ *</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="เช่น 99/1 ม.5 ถนนสุขุมวิท ตำบลแสนสุข"
                rows={3}
                className={`w-full px-4 py-3 rounded-lg border bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#154212] focus:border-transparent outline-none transition-all resize-none ${
                  showTour && visibleTourSteps[tourStep]?.fieldId === 'field-address'
                    ? 'border-[#154212]'
                    : 'border-[#e5e5e5]'
                }`}
              />
            </div>
          )}

          {/* ── 6. เพศ ── */}
          <div id="field-gender" className={fieldWrapClass('field-gender')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">เพศ *</label>
            <ChoiceGroup
              options={GENDERS}
              value={formData.gender}
              onChange={handleChoiceChange('gender')}
              highlighted={showTour && visibleTourSteps[tourStep]?.fieldId === 'field-gender'}
            />
          </div>

          {/* ── 7. ช่วงอายุ ── */}
          <div id="field-ageRange" className={fieldWrapClass('field-ageRange')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">ช่วงอายุ *</label>
            <ChoiceGroup
              options={AGE_RANGES}
              value={formData.ageRange}
              onChange={handleChoiceChange('ageRange')}
              highlighted={showTour && visibleTourSteps[tourStep]?.fieldId === 'field-ageRange'}
            />
          </div>

          {/* ── 8. พื้นที่ตำบล (conditional — เฉพาะคนในชุมชน) ── */}
          {isLocalResident && (
            <div id="field-subdistrict" className={fieldWrapClass('field-subdistrict')}>
              <label className="block text-gray-700 font-medium mb-2 text-sm">พื้นที่ 6 ตำบลหลัก *</label>
              <SelectField
                options={SUBDISTRICTS}
                value={formData.subdistrict}
                onChange={val => setFormData(prev => ({ ...prev, subdistrict: val }))}
                placeholder=" เลือกตำบล "
                highlighted={showTour && visibleTourSteps[tourStep]?.fieldId === 'field-subdistrict'}
              />
            </div>
          )}

          {/* ── 9. อาชีพ ── */}
          <div id="field-occupation" className={fieldWrapClass('field-occupation')}>
            <label className="block text-gray-700 font-medium mb-2 text-sm">
              อาชีพปัจจุบัน / อดีต {!isTourist && '*'}
            </label>
            <SelectField
              options={OCCUPATIONS}
              value={formData.occupation}
              onChange={val => setFormData(prev => ({ ...prev, occupation: val }))}
              placeholder=" เลือกอาชีพ "
              highlighted={showTour && visibleTourSteps[tourStep]?.fieldId === 'field-occupation'}
            />
          </div>

          {/* ── PDPA (อยู่ล่างสุด) ── */}
          <div id="field-pdpa" className={`rounded-xl border transition-colors ${formData.pdpaConsent ? 'border-[#154212] bg-[#f0fdf0]' : 'border-[#e5e5e5] bg-[#f9f9f9]'}`}>
            <label className="flex items-start gap-3 cursor-pointer p-4">
              <input
                type="checkbox"
                name="pdpaConsent"
                checked={formData.pdpaConsent}
                onChange={handleChange}
                className="mt-0.5 w-5 h-5 shrink-0 rounded border-gray-300 text-[#154212] accent-[#154212]"
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

          {/* ── Submit (error shown right here so it's visible at the button) ── */}
          <div className="pt-1 space-y-2">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
                </svg>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              aria-disabled={!isFormComplete}
              className={`w-full font-bold py-3 rounded-lg transition-colors disabled:cursor-not-allowed ${
                isFormComplete
                  ? 'bg-[#154212] text-white hover:bg-[#0d3308]'
                  : 'bg-[#e5e5e5] text-[#8a8a8a] hover:bg-[#dcdcdc]'
              } ${loading ? 'opacity-70' : ''}`}
            >
              {loading
                ? (isEditMode ? 'กำลังบันทึก...' : 'กำลังลงทะเบียน...')
                : (isEditMode ? 'บันทึกข้อมูล' : 'ลงทะเบียน')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-[#154212]">กำลังโหลด...</div></div>}>
      <RegisterPageContent />
    </Suspense>
  )
}
