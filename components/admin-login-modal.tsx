'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Lock } from 'lucide-react'
import { useAdmin } from '@/lib/admin-context'

interface AdminLoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AdminLoginModal({ isOpen, onClose, onSuccess }: AdminLoginModalProps) {
  const [key, setKey] = useState('')
  const [error, setError] = useState(false)
  const { adminLogin } = useAdmin()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setKey('')
      setError(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const ok = adminLogin(key)
    if (ok) {
      onSuccess()
    } else {
      setError(true)
      setKey('')
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-[70]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[calc(100%-48px)] max-w-sm bg-white rounded-2xl shadow-xl p-6">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#154212]/50 hover:text-[#154212] transition-colors"
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
              onChange={(e) => { setKey(e.target.value); setError(false) }}
              placeholder="Admin Key"
              className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-colors ${
                error
                  ? 'border-red-400 bg-red-50 text-red-600 placeholder:text-red-300'
                  : 'border-[#154212]/30 focus:border-[#154212] text-[#154212]'
              }`}
            />
            {error && (
              <p className="text-xs text-red-500 mt-1.5 ml-1">Admin Key ไม่ถูกต้อง</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!key.trim()}
            className="w-full py-3 rounded-xl bg-[#154212] text-white text-sm font-semibold disabled:opacity-40 transition-opacity"
          >
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </>
  )
}
