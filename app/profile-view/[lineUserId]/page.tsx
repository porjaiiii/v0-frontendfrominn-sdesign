'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { PageHeader } from '@/components/page-header'
import { WasteCart } from '@/components/waste-cart'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdmin } from '@/lib/admin-context'

export default function ProfileViewPage() {
  const params = useParams()
  const lineUserId = decodeURIComponent(params.lineUserId as string)
  const { isAdmin, isInitializing, adminLogout } = useAdmin()

  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalWeight, setTotalWeight] = useState(0)
  const [sortMode, setSortMode] = useState<'date' | 'weight'>('date')
  console.log('1. isAdmin:', isAdmin)

  useEffect(() => {
    
    const fetchProfile = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/profile/${encodeURIComponent(lineUserId)}`)
        if (!response.ok) {
          setError(response.status === 404 ? 'ไม่พบผู้ใช้งานนี้ในระบบ' : 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้ โปรดลองใหม่อีกครั้ง')
          return
        }
        const data = await response.json()
        setProfile(data)
      } catch {
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setLoading(false)
      }
    }
    if (lineUserId) fetchProfile()
  }, [lineUserId,isAdmin])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#154212] mx-auto mb-4" />
          <p className="text-[#666666]">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <AlertCircle className="w-16 h-16 text-[#f44336] mb-4" />
          <h1 className="text-xl font-semibold text-[#154212] mb-2">เกิดข้อผิดพลาด</h1>
          <p className="text-center text-[#666666] mb-6">{error || 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้'}</p>
          <Button onClick={() => window.history.back()} className="bg-[#154212] hover:bg-[#154212]/90 text-white">
            กลับไป
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      <PageHeader />

      <main className="max-w-sm mx-auto px-4 pt-5 space-y-4">
        {/* Page Title */}
        <h1 className="text-3xl font-extrabold text-[#154212] text-balance">ข้อมูลการสแกน</h1>

        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-[#154212] p-4 shadow-sm">
          {/* Top row: avatar + name/gender */}
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-full overflow-hidden border-2 border-[#154212] bg-[#e8f5e4]">
              {profile.avatar ? (
                <Image src={profile.avatar} alt={profile.name} width={64} height={64} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-9 h-9 text-[#154212]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs 154212-[#666666] mb-0.5">ชื่อ-นามสกุล</p>
              <p className="font-bold text-[#222222] text-sm">{profile.name || '-'}</p>
              <p className="text-xs 154212-[#666666] mt-1">เพศ <span className="font-semibold text-[#222222]">{profile.gender || '-'}</span></p>
              <p className="text-xs 154212-[#666666] mt-1">เบอร์ <span className="font-semibold text-[#222222]">{profile.phoneNumber || '-'}</span></p>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-0">
            {/* อายุ */}
            <div className="border-t border-[#cccccc] pt-3 pb-3 pr-3">
              <p className="text-xs text-[#154212] mb-1">อายุ</p>
              <p className="text-sm font-bold text-[#222222]">{profile.age ? `${profile.age} ปี` : '-'}</p>
            </div>
            {/* ประเภท */}
            <div className="border-t border-[#cccccc] pt-3 pb-3 pl-3 border-l border-l-[#cccccc]">
              <p className="text-xs text-[#154212] mb-1">ประเภท</p>
              <p className="text-sm font-bold text-[#222222]">{profile.type || '-'}</p>
            </div>
            {/* ตำบล */}
            <div className="border-t border-[#cccccc] pt-3 pr-3">
              <p className="text-xs text-[#154212] mb-1">ตำบล</p>
              <p className="text-sm font-bold text-[#222222]">{profile.subdistrict || '-'}</p>
            </div>
            {/* อาชีพ */}
            <div className="border-t border-[#cccccc] pt-3 pl-3 border-l border-l-[#cccccc]">
              <p className="text-xs text-[#154212] mb-1">อาชีพ</p>
              <p className="text-sm font-bold text-[#222222]">{profile.occupation || '-'}</p>
            </div>
            
          
          </div>
        </div>

        {/* Waste section banner */}
        <div className="bg-[#154212] rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-white font-bold text-base">รายการขยะ</span>
          <span className="text-white font-semibold text-sm">
            น้ำหนักรวม : {totalWeight > 0 ? `${totalWeight.toFixed(0)} กก.` : '0 กก.'}
          </span>
        </div>

        {/* Sort buttons */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setSortMode('date')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              sortMode === 'date'
                ? 'bg-[#154212] text-white border-[#154212]'
                : 'bg-white text-[#154212] border-[#154212]'
            }`}
          >
            เรียงตามวันที่ล่าสุด
          </button>
          <button
            onClick={() => setSortMode('weight')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              sortMode === 'weight'
                ? 'bg-[#154212] text-white border-[#154212]'
                : 'bg-white text-[#154212] border-[#154212]'
            }`}
          >
            เรียงตามน้ำหนักมากสุด
          </button>
        </div>

        {/* Waste Cart */}
        <WasteCart
          userId={profile.lineUserId || lineUserId}
          onTotalWeightChange={setTotalWeight}
          sortMode={sortMode}
        />
      </main>
    </div>
  )
}
