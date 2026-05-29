'use client'

import Image from 'next/image'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { Award, TreePine, ChevronLeft, ChevronRight, QrCode, ExternalLink } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useState } from 'react'
import { useLiffContext } from '@/lib/liff-context'
import { useApp } from '@/lib/app-context'
import { Button } from '@/components/ui/button'

// Badge levels data with gradient colors
const BADGE_LEVELS = [
  { id: 1, name: 'นักอนุรักษ์มือใหม่', min: 0, max: 149, gradient: 'from-[#b589ea] to-[#df89ea]', iconColor: 'text-[#9b59b6]', active: true },
  { id: 2, name: 'นักอนุรักษ์ระดับกลาง', min: 150, max: 299, gradient: 'from-[#f9e7b0] to-[#ffc818]', iconColor: 'text-[#f1c40f]', active: false },
  { id: 3, name: 'นักอนุรักษ์ระดับสูง', min: 300, max: 499, gradient: 'from-[#b6ebad] to-[#6fc061]', iconColor: 'text-[#27ae60]', active: false },
  { id: 4, name: 'นักอนุรักษ์ระดับผู้เชี่ยวชาญ', min: 500, max: 999, gradient: 'from-[#f5c4c4] to-[#c06161]', iconColor: 'text-[#e74c3c]', active: false },
]

export default function ProfilePage() {
  const [currentBadgeIndex, setCurrentBadgeIndex] = useState(0)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  
  const { isReady, isLoggedIn, profile: liffProfile, scanCode, openExternalBrowser, isInClient } = useLiffContext()
  const { userProfile } = useApp()
  
  // Use LINE profile if available, otherwise use demo data
  const user = {
    name: 'สมหวัง คนดี222', // Demo name - can be updated from user settings
    lineUsername: liffProfile?.displayName || userProfile?.displayName || 'ผู้ใช้ทดสอบ',
    gender: 'หญิง',
    age: '21-40 ปี',
    type: 'ชาวบางกระเจ้า',
    subdistrict: 'บางกอบัว',
    occupation: 'เกษตรกร',
    avatar: liffProfile?.pictureUrl || userProfile?.pictureUrl || '/placeholder-user.jpg',
  }

  const stats = {
    co2Reduced: 100,
    treesPlanted: 6,
    totalRecycled: 49.50,
  }

  const recycleData = [
    { name: 'พลาสติก', value: 30.5, color: '#6fc061' },
    { name: 'แก้ว', value: 10, color: '#c06161' },
    { name: 'กระดาษ', value: 5, color: '#d7ce56' },
    { name: 'อลูมิเนียม', value: 8, color: '#606dc0' },
    { name: 'น้ำมันเก่า', value: 0, color: '#60c098' },
  ]

  const co2Data = [
    { name: 'พลาสติก', value: 67.42, color: '#6fc061' },
    { name: 'แก้ว', value: 22.15, color: '#c06161' },
    { name: 'กระดาษ', value: 6.26, color: '#d7ce56' },
    { name: 'อลูมิเนียม', value: 4.2, color: '#606dc0' },
    { name: 'น้ำมันเก่า', value: 0, color: '#60c098' },
  ]

  const currentBadge = BADGE_LEVELS[currentBadgeIndex]
  const badgeProgress = (stats.totalRecycled / currentBadge.max) * 100

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

  const handleScanQR = async () => {
    try {
      setIsScanning(true)
      setScanResult(null)
      const result = await scanCode()
      if (result.value) {
        setScanResult(result.value)
      }
    } catch (err) {
      console.error('Scan failed:', err)
      alert('ไม่สามารถเปิดกล้องสแกน QR Code ได้')
    } finally {
      setIsScanning(false)
    }
  }

  const handleOpenExternal = (url: string) => {
    openExternalBrowser(url)
  }

  // Note: We no longer block on isReady to avoid infinite loading
  // The page will show demo data if LIFF is not available

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Profile Card with overlapping avatar */}
        <div className="relative mt-12 mb-6">
          {/* Avatar - positioned to overlap top of card */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-10">
            <div className="relative w-[90px] h-[90px] rounded-full overflow-hidden border-4 border-white shadow-lg">
              <Image
                src={user.avatar}
                alt={user.name}
                fill
                className="object-cover"
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
                  <span className="ml-4 text-[#154212] font-medium">{user.name}</span>
                </div>
                <div>
                  <span className="text-[#666666]">เพศ</span>
                  <span className="ml-2 text-[#154212] font-medium">{user.gender}</span>
                </div>
              </div>

              {/* Row 2: LINE Username */}
              <div className="flex">
                <div className="flex-1">
                  <span className="text-[#666666]">LINE Username</span>
                  <span className="ml-4 text-[#154212] font-medium">{user.lineUsername}</span>
                </div>
              </div>

              {/* Row 3: Age & Type */}
              <div className="flex">
                <div className="flex-1">
                  <span className="text-[#666666]">อายุ</span>
                  <span className="ml-4 text-[#154212] font-medium">{user.age}</span>
                </div>
                <div>
                  <span className="text-[#666666]">ประเภท</span>
                  <span className="ml-2 text-[#154212] font-medium">{user.type}</span>
                </div>
              </div>

              {/* Row 4: Subdistrict & Occupation */}
              <div className="flex">
                <div className="flex-1">
                  <span className="text-[#666666]">ตำบล</span>
                  <span className="ml-4 text-[#154212] font-medium">{user.subdistrict}</span>
                </div>
                <div>
                  <span className="text-[#666666]">อาชีพ</span>
                  <span className="ml-2 text-[#154212] font-medium">{user.occupation}</span>
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

        {/* LIFF Features Section */}
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-4 mb-4 shadow-sm">
          <p className="text-sm font-semibold text-[#154212] mb-3">LINE LIFF Features</p>
          <div className="grid grid-cols-2 gap-3">
            {/* Scan QR Code */}
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 border-[#154212] text-[#154212] hover:bg-[#154212]/5"
              onClick={handleScanQR}
              disabled={isScanning || !isInClient}
            >
              <QrCode className="w-6 h-6" />
              <span className="text-xs">{isScanning ? 'กำลังสแกน...' : 'สแกน QR Code'}</span>
            </Button>

            {/* Open External Browser */}
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 border-[#154212] text-[#154212] hover:bg-[#154212]/5"
              onClick={() => handleOpenExternal('https://lin.ee/')}
            >
              <ExternalLink className="w-6 h-6" />
              <span className="text-xs">เปิดเบราว์เซอร์</span>
            </Button>
          </div>

          {/* QR Scan Result */}
          {scanResult && (
            <div className="mt-4 p-3 bg-[#f0f9f0] rounded-lg border border-[#6fc061]">
              <p className="text-xs text-[#666666] mb-1">ผลลัพธ์จากการสแกน:</p>
              <p className="text-sm font-medium text-[#154212] break-all">{scanResult}</p>
            </div>
          )}

          {/* LIFF Info */}
          {!isInClient && (
            <p className="mt-3 text-xs text-[#999999] text-center">
              บางฟีเจอร์ใช้งานได้เฉพาะในแอป LINE เท่านั้น
            </p>
          )}
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
                    data={recycleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={50}
                    dataKey="value"
                  >
                    {recycleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend */}
            <div className="flex-1 space-y-1">
              {recycleData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[#666666]">{item.name}</span>
                  <span className="ml-auto font-medium text-[#154212]">{item.value} KG</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pie Chart - CO2 Breakdown (changed from bar to pie) */}
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-4 mb-4 shadow-sm">
          <p className="text-sm font-semibold text-[#154212] mb-3">การทำการสะสมของ Recycle เป็น Co2 ของคุณ</p>
          
          <div className="flex items-center gap-4">
            <div className="w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={co2Data}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={50}
                    dataKey="value"
                  >
                    {co2Data.map((entry, index) => (
                      <Cell key={`cell-co2-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend */}
            <div className="flex-1 space-y-1">
              {co2Data.map((item) => (
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
