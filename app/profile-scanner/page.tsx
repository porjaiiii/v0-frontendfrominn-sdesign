'use client'

import Image from 'next/image'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { Award, TreePine, ChevronLeft, ChevronRight, Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useState, useEffect } from 'react'
import { useLiffContext } from '@/lib/liff-context'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

// Badge levels data with gradient colors
const BADGE_LEVELS = [
  { id: 1, name: 'นักอนุรักษ์มือใหม่', min: 0, max: 149, gradient: 'from-[#b589ea] to-[#df89ea]', iconColor: 'text-[#9b59b6]', active: true },
  { id: 2, name: 'นักอนุรักษ์ระดับกลาง', min: 150, max: 299, gradient: 'from-[#f9e7b0] to-[#ffc818]', iconColor: 'text-[#f1c40f]', active: false },
  { id: 3, name: 'นักอนุรักษ์ระดับสูง', min: 300, max: 499, gradient: 'from-[#b6ebad] to-[#6fc061]', iconColor: 'text-[#27ae60]', active: false },
  { id: 4, name: 'นักอนุรักษ์ระดับผู้เชี่ยวชาญ', min: 500, max: 999, gradient: 'from-[#f5c4c4] to-[#c06161]', iconColor: 'text-[#e74c3c]', active: false },
]

interface ScannedUserProfile {
  name: string
  lineUsername: string
  gender: string
  age: string
  type: string
  subdistrict: string
  occupation: string
  avatar: string
  co2Reduced: number
  treesPlanted: number
  totalRecycled: number
  recycleData: Array<{ name: string; value: number; color: string }>
  co2Data: Array<{ name: string; value: number; color: string }>
}

export default function ProfileScannerPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [scannedLineId, setScannedLineId] = useState<string | null>(null)
  const [scannedProfile, setScannedProfile] = useState<ScannedUserProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentBadgeIndex, setCurrentBadgeIndex] = useState(0)
  
  const { scanCode, isInClient } = useLiffContext()

  const handleScanQR = async () => {
    try {
      setIsScanning(true)
      setError(null)
      setScannedProfile(null)
      setScannedLineId(null)
      
      const result = await scanCode()
      if (result.value) {
        setScannedLineId(result.value)
        await fetchProfileByLineId(result.value)
      }
    } catch (err) {
      console.error('[v0] Scan failed:', err)
      setError('ไม่สามารถเปิดกล้องสแกน QR Code ได้')
    } finally {
      setIsScanning(false)
    }
  }

  const fetchProfileByLineId = async (lineId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      
      console.log('[v0] Fetching profile for LINE ID:', lineId)
      
      const response = await fetch(`/api/profile/${encodeURIComponent(lineId)}`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      const data = await response.json()
      setScannedProfile(data)
      setCurrentBadgeIndex(0)
    } catch (err) {
      console.error('[v0] Failed to fetch profile:', err)
      setError('ไม่พบข้อมูลโปรไฟล์นี้')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrevBadge = () => {
    if (currentBadgeIndex > 0) {
      setCurrentBadgeIndex(currentBadgeIndex - 1)
    }
  }

  const handleNextBadge = () => {
    if (currentBadgeIndex < BADGE_LEVELS.length - 1) {
      setCurrentBadgeIndex(currentBadgeIndex + 1)
    }
  }

  if (!scannedProfile) {
    return (
      <div className="min-h-screen bg-white pb-24">
        <PageHeader />

        <main className="max-w-md mx-auto px-4 py-4">
          <Link href="/profile" className="inline-flex items-center gap-2 text-[#154212] hover:text-[#154212]/80 mb-4">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">กลับ</span>
          </Link>

          <div className="space-y-4">
            <div className="bg-gradient-to-br from-[#c7e3ff] to-[#b6ebad] rounded-xl p-6">
              <h1 className="text-2xl font-bold text-[#154212] mb-2">ดูโปรไฟล์ผู้อื่น</h1>
              <p className="text-sm text-[#154212]/80">สแกน QR Code เพื่อดูข้อมูลโปรไฟล์และสถิติการรีไซเคิลของผู้อื่น</p>
            </div>

            {isInClient ? (
              <Button
                onClick={handleScanQR}
                disabled={isScanning || isLoading}
                className="w-full bg-[#154212] hover:bg-[#154212]/90 text-white h-14 rounded-lg text-base font-semibold"
              >
                {isScanning || isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    {isLoading ? 'กำลังโหลดข้อมูล...' : 'กำลังเปิดกล้อง...'}
                  </>
                ) : (
                  'สแกน QR Code'
                )}
              </Button>
            ) : (
              <div className="bg-[#fef3cd] border border-[#ffc107] rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-[#ff9800] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#666666]">ฟีเจอร์สแกน QR Code ใช้งานได้เฉพาะในแอป LINE เท่านั้น</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-[#ffebee] border border-[#f44336] rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-[#f44336] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#c62828]">{error}</p>
                </div>
              </div>
            )}
          </div>
        </main>

        <BottomNav />
      </div>
    )
  }

  // Show scanned profile
  const stats = {
    co2Reduced: scannedProfile.co2Reduced,
    treesPlanted: scannedProfile.treesPlanted,
    totalRecycled: scannedProfile.totalRecycled,
  }

  const currentBadge = BADGE_LEVELS[currentBadgeIndex]
  const badgeProgress = (stats.totalRecycled / currentBadge.max) * 100

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        <Link href="/profile-scanner" className="inline-flex items-center gap-2 text-[#154212] hover:text-[#154212]/80 mb-4">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">สแกนอีกครั้ง</span>
        </Link>

        {/* Profile Card with overlapping avatar */}
        <div className="relative mt-12 mb-6">
          {/* Avatar - positioned to overlap top of card */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-10">
            <div className="relative w-[90px] h-[90px] rounded-full overflow-hidden border-4 border-white shadow-lg">
              <Image
                src={scannedProfile.avatar}
                alt={scannedProfile.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          </div>

          {/* White Card with gray border */}
          <div className="bg-white border border-[#e5e5e5] rounded-2xl pt-14 pb-5 px-4 shadow-sm">
            {/* Profile Info */}
            <div className="space-y-3 text-sm">
              {/* Row 1: Name & Gender */}
              <div className="flex">
                <div className="flex-1">
                  <span className="text-[#666666]">ชื่อ-นามสกุล</span>
                  <span className="ml-4 text-[#154212] font-medium">{scannedProfile.name}</span>
                </div>
                <div>
                  <span className="text-[#666666]">เพศ</span>
                  <span className="ml-2 text-[#154212] font-medium">{scannedProfile.gender}</span>
                </div>
              </div>

              {/* Row 2: LINE Username */}
              <div className="flex">
                <div className="flex-1">
                  <span className="text-[#666666]">LINE Username</span>
                  <span className="ml-4 text-[#154212] font-medium">{scannedProfile.lineUsername}</span>
                </div>
              </div>

              {/* Row 3: Age & Type */}
              <div className="flex">
                <div className="flex-1">
                  <span className="text-[#666666]">อายุ</span>
                  <span className="ml-4 text-[#154212] font-medium">{scannedProfile.age}</span>
                </div>
                <div>
                  <span className="text-[#666666]">ประเภท</span>
                  <span className="ml-2 text-[#154212] font-medium">{scannedProfile.type}</span>
                </div>
              </div>

              {/* Row 4: Subdistrict & Occupation */}
              <div className="flex">
                <div className="flex-1">
                  <span className="text-[#666666]">ตำบล</span>
                  <span className="ml-4 text-[#154212] font-medium">{scannedProfile.subdistrict}</span>
                </div>
                <div>
                  <span className="text-[#666666]">อาชีพ</span>
                  <span className="ml-2 text-[#154212] font-medium">{scannedProfile.occupation}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* CO2 Reduced Card - Green background */}
          <div className="bg-[#154212] rounded-xl p-4">
            <p className="text-xs text-white/80 mb-1">คุณช่วยลดการปล่อย CO</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">{stats.co2Reduced}</span>
              <span className="text-sm text-white/80">kgCO2</span>
            </div>
          </div>

          {/* Trees Planted Card - Green background */}
          <div className="bg-[#154212] rounded-xl p-4">
            <p className="text-xs text-white/80 mb-1">ต้นไม้ที่การช่วยปลูก</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-white">{stats.treesPlanted}</span>
              <span className="text-sm text-white/80">ต้น</span>
              <TreePine className="w-6 h-6 text-[#6fc061] ml-auto" />
            </div>
          </div>
        </div>

        {/* Total Recycled Card - Pastel gradient */}
        <div className="bg-gradient-to-r from-[#c7e3ff] to-[#b6ebad] rounded-xl p-4 mb-4">
          <p className="text-xs text-[#154212] mb-1">คุณมีของที่รีไซเคิลแล้ว</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-[#154212]">{stats.totalRecycled.toFixed(2)}</span>
            <span className="text-lg text-[#154212]">Kg</span>
          </div>
        </div>

        {/* Badge Section with Navigation */}
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-4 mb-4 shadow-sm">
          {/* Badge Icons Row with Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={handlePrevBadge}
              disabled={currentBadgeIndex === 0}
              className="p-1 text-[#154212] disabled:text-[#c1c1c1]"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3">
              {BADGE_LEVELS.map((badge, index) => (
                <button 
                  key={badge.id}
                  onClick={() => setCurrentBadgeIndex(index)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-r ${badge.gradient} transition-all ${
                    index === currentBadgeIndex ? 'ring-2 ring-[#154212] ring-offset-1' : ''
                  }`}
                >
                  <Award className={`w-5 h-5 ${badge.iconColor}`} />
                </button>
              ))}
            </div>
            
            <button 
              onClick={handleNextBadge}
              disabled={currentBadgeIndex === BADGE_LEVELS.length - 1}
              className="p-1 text-[#154212] disabled:text-[#c1c1c1]"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Badge Info */}
          <div className="text-center mb-3">
            <p className="text-base font-semibold text-[#154212]">{currentBadge.name}</p>
            <p className="text-xs text-[#666666]">สะสมของรีไซเคิล</p>
            <p className="text-lg font-bold text-[#6fc061]">
              จำนวน : {currentBadge.min} - {currentBadge.max} กิโลกรัม
            </p>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-2">
            <p className="text-xs text-[#666666] mb-1">ความคืบหน้า</p>
            <div className="w-full h-2 bg-[#e5e5e5] rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#91c1e7] to-[#9fcba5] rounded-full"
                style={{ width: `${Math.min(badgeProgress, 100)}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-[#999999]">
            สะสมของรีไซเคิลอีก {(currentBadge.max - stats.totalRecycled).toFixed(2)} กิโลกรัม เพื่อปลดล็อคระดับถัดไป
          </p>
        </div>

        {/* Pie Chart - Recycle Breakdown */}
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-4 mb-4 shadow-sm">
          <p className="text-sm font-semibold text-[#154212] mb-3">การทำการสะสมของ Recycle ของคุณ</p>
          
          <div className="flex items-center gap-4">
            <div className="w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scannedProfile.recycleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={50}
                    dataKey="value"
                  >
                    {scannedProfile.recycleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend */}
            <div className="flex-1 space-y-1">
              {scannedProfile.recycleData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[#666666]">{item.name}</span>
                  <span className="ml-auto font-medium text-[#154212]">{item.value} KG</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pie Chart - CO2 Breakdown */}
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-4 mb-4 shadow-sm">
          <p className="text-sm font-semibold text-[#154212] mb-3">การทำการสะสมของ Recycle เป็น Co2 ของคุณ</p>
          
          <div className="flex items-center gap-4">
            <div className="w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scannedProfile.co2Data}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={50}
                    dataKey="value"
                  >
                    {scannedProfile.co2Data.map((entry, index) => (
                      <Cell key={`cell-co2-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend */}
            <div className="flex-1 space-y-1">
              {scannedProfile.co2Data.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[#666666]">{item.name}</span>
                  <span className="ml-auto font-medium text-[#154212]">{item.value} kgCO2</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
