'use client'

import { type LiffLoadingStep } from '@/hooks/use-liff'

interface StepInfo {
  label: string
  description: string
}

const STEP_INFO: Record<LiffLoadingStep, StepInfo> = {
  idle: {
    label: 'กำลังเตรียมระบบ',
    description: 'โปรดรอสักครู่...',
  },
  initializing: {
    label: 'กำลังเชื่อมต่อ LINE',
    description: 'กำลังเริ่มต้นระบบ LIFF กับ LINE...',
  },
  requesting_permission: {
    label: 'กำลังขอสิทธิ์การเข้าถึง',
    description: 'กำลังนำคุณไปยังหน้าอนุญาตของ LINE...',
  },
  fetching_profile: {
    label: 'กำลังโหลดข้อมูลโปรไฟล์',
    description: 'กำลังดึงข้อมูลบัญชี LINE ของคุณ...',
  },
  ready: {
    label: 'พร้อมใช้งาน',
    description: '',
  },
}

const STEP_ORDER: LiffLoadingStep[] = [
  'initializing',
  'requesting_permission',
  'fetching_profile',
  'ready',
]

interface Props {
  step: LiffLoadingStep
}

export function LiffLoadingOverlay({ step }: Props) {
  if (step === 'ready' || step === 'idle') return null

  const info = STEP_INFO[step]
  const currentIndex = STEP_ORDER.indexOf(step)

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
      role="status"
      aria-live="polite"
      aria-label={info.label}
    >
      {/* Logo / brand area */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-[#154212] flex items-center justify-center shadow-lg">
          <svg
            className="w-9 h-9 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        </div>
        <span className="text-[#154212] font-bold text-lg tracking-wide">
          Digital Wasted Account
        </span>
      </div>

      {/* Spinner */}
      <div className="relative mb-6">
        <svg
          className="animate-spin w-12 h-12 text-[#154212]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-80"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>

      {/* Step label */}
      <p className="text-[#154212] font-semibold text-base mb-1 text-center px-6">
        {info.label}
      </p>
      <p className="text-gray-500 text-sm text-center px-8 mb-8 leading-relaxed">
        {info.description}
      </p>

      {/* Step dots */}
      <div className="flex items-center gap-2" role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemax={STEP_ORDER.length - 1}>
        {STEP_ORDER.filter(s => s !== 'ready').map((s, i) => (
          <div
            key={s}
            className={`rounded-full transition-all duration-300 ${
              i < currentIndex
                ? 'w-2.5 h-2.5 bg-[#154212]'
                : i === currentIndex
                ? 'w-3 h-3 bg-[#154212] ring-2 ring-[#154212]/30'
                : 'w-2.5 h-2.5 bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Step counter */}
      <p className="text-gray-400 text-xs mt-3">
        ขั้นตอนที่ {currentIndex + 1} / {STEP_ORDER.length - 1}
      </p>
    </div>
  )
}
