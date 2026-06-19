'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Lock, Loader2 } from 'lucide-react'
import { useAdmin } from '@/lib/admin-context'
import { useLiffContext } from '@/lib/liff-context'

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
  const [key, setKey] = useState('')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { adminLogin } = useAdmin()
  const { profile } = useLiffContext()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
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
    const result = await adminLogin(key.trim(), userId)

    setLoading(false)

    if (result.success) {
      onSuccess()
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

        {/* Icon */}
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
            {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </>
  )
}
