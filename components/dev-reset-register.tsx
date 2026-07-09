'use client'

// ⚠️ TEMPORARY — for testing only.
// Floating button that clears the "registered" cache so you can re-run the
// registration flow. To disable: set ENABLED to false (or delete the
// <DevResetRegister /> line in app/layout.tsx and this file).
const ENABLED = true

export function DevResetRegister() {
  if (!ENABLED) return null

  const handleReset = () => {
    try {
      localStorage.removeItem('is_registered')
    } catch {}
    // back to the register flow
    window.location.href = '/register'
  }

  return (
    <button
      onClick={handleReset}
      className="fixed bottom-28 right-3 z-[9999] rounded-full bg-red-600 px-3 py-2 text-xs font-medium text-white shadow-lg active:scale-95"
    >
      ล้าง cache สมัคร
    </button>
  )
}
