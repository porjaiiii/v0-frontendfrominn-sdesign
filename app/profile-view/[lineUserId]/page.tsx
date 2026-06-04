'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { WasteCart } from '@/components/waste-cart'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ProfileViewPage() {
  const params = useParams()
  const lineUserId = decodeURIComponent(params.lineUserId as string)
  
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentBadgeIndex, setCurrentBadgeIndex] = useState(0)
  const [totalWeight, setTotalWeight] = useState(0)

  // Fetch profile data when page loads
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('[v0] Fetching profile for LINE ID:', lineUserId)
        
        const response = await fetch(`/api/profile/${encodeURIComponent(lineUserId)}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('ไม่พบผู้ใช้งานนี้ในระบบ')
          } else {
            setError('ไม่สามารถดึงข้อมูลโปรไฟล์ได้ โปรดลองใหม่อีกครั้ง')
          }
          return
        }
        
        const data = await response.json()
        setProfile(data)
        console.log('[v0] Profile loaded:', data.name)
      } catch (err) {
        console.error('[v0] Error fetching profile:', err)
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setLoading(false)
      }
    }
    
    if (lineUserId) {
      fetchProfile()
    }
  }, [lineUserId])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#154212] mx-auto mb-4"></div>
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
          <Button 
            onClick={() => window.history.back()}
            className="bg-[#154212] hover:bg-[#154212]/90 text-white"
          >
            กลับไป
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f7f0] to-white pb-24">
      <PageHeader title="ดูโปรไฟล์" />
      
      <main className="max-w-sm mx-auto px-4 py-6 space-y-4">
        {/* Header Title */}
        <h2 className="text-base font-bold text-[#154212]">ข้อมูลการแสลน</h2>

        {/* Profile Card - Avatar Left + Info + Total Weight Right */}
        <div className="bg-white rounded-xl border border-[#999999] p-5 shadow-sm">
          <div className="flex gap-4 mb-4 items-start">
            {/* Avatar Circle */}
            <div className="flex-shrink-0">
              {profile.avatar ? (
                <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-[#154212]">
                  <Image
                    src={profile.avatar}
                    alt={profile.name}
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full border-3 border-[#154212] bg-[#f0f7f0] flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#154212]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              )}
            </div>

            {/* User Info Center */}
            <div className="flex-1">
              <h1 className="text-base font-bold text-[#154212]">{profile.name}</h1>
              <p className="text-xs text-[#666666] mb-2">
                {profile.age && `${profile.age} | `}
                {profile.gender || 'ไม่ระบุ'}
              </p>
              
              {profile.subdistrict && (
                <p className="text-xs text-[#999999] mb-1">{profile.subdistrict}</p>
              )}
              
              {profile.occupation && (
                <p className="text-xs font-semibold text-[#154212]">{profile.occupation}</p>
              )}
            </div>

            {/* Total Weight Right */}
            {totalWeight > 0 && (
              <div className="bg-[#154212] text-white rounded-xl p-3 flex-shrink-0 text-right">
                <p className="text-xs text-gray-200 mb-1">รายการระะ</p>
                <p className="text-2xl font-bold">{totalWeight.toFixed(2)}</p>
                <p className="text-xs text-gray-200">น้ำหนักรวม</p>
              </div>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="border-t border-[#e5e5e5] pt-2">
              <p className="text-[#666666] mb-1">อายุ</p>
              <p className="font-bold text-[#154212]">{profile.age || '-'} ปี</p>
            </div>
            <div className="border-t border-[#e5e5e5] pt-2">
              <p className="text-[#666666] mb-1">เพศ</p>
              <p className="font-bold text-[#154212]">{profile.gender || '-'}</p>
            </div>
            <div className="border-t border-[#e5e5e5] pt-2">
              <p className="text-[#666666] mb-1">สำนัก</p>
              <p className="font-bold text-[#154212]">{profile.subdistrict || '-'}</p>
            </div>
            <div className="border-t border-[#e5e5e5] pt-2">
              <p className="text-[#666666] mb-1">อาชีพ</p>
              <p className="font-bold text-[#154212]">{profile.occupation || '-'}</p>
            </div>
          </div>
        </div>

        {/* Waste Cart Section */}
        <div>
          <WasteCart 
            userId={profile.lineUserId || lineUserId}
            onTotalWeightChange={setTotalWeight}
          />
        </div>
      </main>

      {/* <BottomNav /> */}
    </div>
  )
}
