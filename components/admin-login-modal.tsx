'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Lock, Loader2, QrCode } from 'lucide-react'
import { useAdmin } from '@/lib/admin-context'
import { useLiffContext } from '@/lib/liff-context'
// อย่าลืม import Component QR Code ของคุณให้ถูกต้องตาม path จริง
import { BrandedQRCode } from '@/components/branded-qr-code' 

interface AdminLoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const ERROR_MESSAGES: Record<string, string> = {
  KEY_INVALID: 'Admin Key ไม่ถูกต้อง หรือไม่มีในระบบ',
  KEY_TAKEN: 'Key นี้ถูกผูกกับบัญชีอื่นแล้ว ไม่สามารถใช้ได้',
  NETWORK_ERROR: 'ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้ง',
  UNKNOWN_ERROR: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
}

export function AdminLoginModal({ isOpen, onClose, onSuccess }: AdminLoginModalProps) {
  // เพิ่ม State จัดการ Step (input = หน้ากรอกรหัส, qr = หน้าโชว์ QR รออนุมัติ)
  const [step, setStep] = useState<'input' | 'qr'>('input')
  const [refCode, setRefCode] = useState<string>('')

  const [key, setKey] = useState('')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { adminLogin } = useAdmin()
  const { profile } = useLiffContext()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setStep('input')
      setRefCode('')
      setKey('')
      setErrorCode(null)
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim() || loading) return

    setLoading(true)
    setErrorCode(null)

    const userId = profile?.userId ?? ''
    
    // หมายเหตุ: ในระบบจริง หากมีระบบรออนุมัติ อาจจะยังไม่เรียก adminLogin ทันที 
    // หรือ API อาจจะต้องคืนค่าสถานะ 'WAITING_APPROVAL' กลับมาแทน
    const result = await adminLogin(key.trim(), userId)

    setLoading(false)

    if (result.success) {
      // เมื่อผ่านการตรวจ Key เบื้องต้น ให้เปลี่ยนหน้าเป็น QR Mock
      const generateMockRef = `REQ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      setRefCode(generateMockRef)
      setStep('qr')
    } else {
      setErrorCode(result.reason)
      setKey('')
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-[70]" onClick={!loading ? onClose : undefined} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[calc(100%-48px)] max-w-sm bg-white rounded-2xl shadow-xl p-6">
        {/* Close */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-[#154212]/50 hover:text-[#154212] transition-colors disabled:opacity-30"
          aria-label="ปิด"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'input' ? (
          // ================= STEP 1: กรอก Admin Key =================
          <>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-[#154212]/10 flex items-center justify-center">
                <Lock className="w-7 h-7 text-[#154212]" />
              </div>
            </div>

            <h2 className="text-lg font-semibold text-[#154212] text-center mb-1">
              เข้าสู่ระบบผู้ดูแล
            </h2>
            <p className="text-sm text-[#154212]/60 text-center mb-5">
              กรอก Admin Key เพื่อเข้าถึงหน้าจัดการ
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  ref={inputRef}
                  type="password"
                  value={key}
                  onChange={(e) => { setKey(e.target.value); setErrorCode(null) }}
                  placeholder="Admin Key"
                  disabled={loading}
                  className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-colors disabled:opacity-50 ${
                    errorCode
                      ? 'border-red-400 bg-red-50 text-red-600 placeholder:text-red-300'
                      : 'border-[#154212]/30 focus:border-[#154212] text-[#154212]'
                  }`}
                />
                {errorCode && (
                  <p className="text-xs text-red-500 mt-1.5 ml-1">
                    {ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.UNKNOWN_ERROR}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!key.trim() || loading}
                className="w-full py-3 rounded-xl bg-[#154212] text-white text-sm font-semibold disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'กำลังตรวจสอบ...' : 'ถัดไป'}
              </button>
            </form>
          </>
        ) : (
          // ================= STEP 2: รอการอนุมัติจากหัวหน้า (Mock QR) =================
          <>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                <QrCode className="w-7 h-7 text-[#154212]" />
              </div>
            </div>

            <h2 className="text-lg font-semibold text-[#154212] text-center mb-1">
              รอการอนุมัติ
            </h2>
            <p className="text-sm text-[#154212]/60 text-center mb-2">
              ระบบQRCODEจะมาในอนาคต
            </p>

            {/* QR Code */}
            <div className="bg-white rounded-3xl p-4 mt-2 mx-auto shadow-sm border border-gray-100 flex flex-col items-center justify-center relative z-10 gap-2 w-fit">
              <BrandedQRCode value={`admin-auth:${refCode}`} size={200} />
              <p className="text-[12px] text-[#888888] tracking-widest font-mono select-all mt-1">
                REF: {refCode}
              </p>
            </div>

            {/* ปุ่มสำหรับเทสต์ (Mock) ว่าหัวหน้าสแกนอนุมัติแล้ว */}
            <button
              onClick={onSuccess}
              className="mt-6 w-full py-3 rounded-xl bg-[#154212] text-white text-sm font-semibold hover:bg-[#666b66] transition-colors"
            >
              สามารถดำเนินการต่อได้เลย
            </button>
          </>
        )}
      </div>
    </>
  )
}