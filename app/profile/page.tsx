'use client'

import Image from 'next/image'
import { useEffect } from 'react'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { Award, TreePine, ChevronLeft, ChevronRight, QrCode, ExternalLink, Copy, Check, ArrowLeft } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiffContext } from '@/lib/liff-context'
import { useApp } from '@/lib/app-context'
import { usePoints } from '@/lib/points-context'
import { MOCK_USER } from '@/lib/mock-user'
import { Button } from '@/components/ui/button'
import { BrandedQRCode } from '@/components/branded-qr-code'

// Badge levels data with gradient colors
const BADGE_LEVELS = [
  { id: 1, name: 'นักอนุรักษ์มือใหม่', min: 0, max: 149, gradient: 'from-[#b589ea] to-[#df89ea]', iconColor: 'text-[#9b59b6]', active: true },
  { id: 2, name: 'นักอนุรักษ์ระดับกลาง', min: 150, max: 299, gradient: 'from-[#f9e7b0] to-[#ffc818]', iconColor: 'text-[#f1c40f]', active: false },
  { id: 3, name: 'นักอนุรักษ์ระดับสูง', min: 300, max: 499, gradient: 'from-[#b6ebad] to-[#6fc061]', iconColor: 'text-[#27ae60]', active: false },
  { id: 4, name: 'นักอนุรักษ์ระดับผู้เชี่ยวชาญ', min: 500, max: 999, gradient: 'from-[#f5c4c4] to-[#c06161]', iconColor: 'text-[#e74c3c]', active: false },
]

// Recycle waste types → Thai label + chart color (shared by both graphs)
const WASTE_META: Record<string, { label: string; color: string }> = {
  plastic:  { label: 'พลาสติก',    color: '#6fc061' },
  glass:    { label: 'แก้ว',       color: '#606dc0' },
  paper:    { label: 'กระดาษ',     color: '#c06161' },
  aluminum: { label: 'อลูมิเนียม', color: '#d7ce56' },
  oil:      { label: 'น้ำมันเก่า', color: '#60c098' },
}
const WASTE_ORDER = ['plastic', 'glass', 'paper', 'aluminum', 'oil']

// One row of the co2_collection sheet (per user, per waste type)
type Co2Row = { waste_type: string; weight: number; co2: number }

// Shown inside a graph card when there's no data yet
function EmptyGraph() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-full bg-[#f5f5f5] flex items-center justify-center mb-2">
        <TreePine className="w-6 h-6 text-[#b5b5b5]" />
      </div>
      <p className="text-sm text-[#999999]">ยังไม่มีข้อมูล</p>
      <p className="text-xs text-[#bbbbbb] mt-0.5">เริ่มเก็บขยะรีไซเคิลเพื่อดูสถิติของคุณ</p>
    </div>
  )
}

export default function ProfilePage() {
  const [currentBadgeIndex, setCurrentBadgeIndex] = useState(0)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [copiedLineId, setCopiedLineId] = useState(false)
  const [fetchedProfile, setFetchedProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [co2Collection, setCo2Collection] = useState<Co2Row[] | null>(null)
  
  const router = useRouter()
  const { isReady, isLoggedIn, profile: liffProfile, scanCode, openExternalBrowser, isInClient } = useLiffContext()
  const { userProfile } = useApp()
  const { carbon: dbCarbon, weight: dbWeight } = usePoints()
  
  // Fetch profile data from API
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!liffProfile?.userId) {
        return
      }
      
      try {
        setProfileLoading(true)
        const response = await fetch(`/api/profile/${encodeURIComponent(liffProfile.userId)}`)
        
        if (response.ok) {
          const data = await response.json()
          setFetchedProfile(data)
        } else {
          setFetchedProfile(null)
        }
      } catch (error) {
        console.error('[v0] Error fetching profile:', error)
        setFetchedProfile(null)
      } finally {
        setProfileLoading(false)
      }
    }
    
    fetchUserProfile()
  }, [liffProfile?.userId])

  // Fetch the per-waste-type breakdown (co2_collection sheet) for the graphs
  useEffect(() => {
    const userId = liffProfile?.userId
    if (!userId) {
      setCo2Collection([]) // guest / not logged in → treat as no data
      return
    }
    const controller = new AbortController()
    fetch(`/api/points?action=get_co2_collection&user_id=${encodeURIComponent(userId)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) =>
        setCo2Collection(
          data?.success && Array.isArray(data.collection) ? (data.collection as Co2Row[]) : []
        )
      )
      .catch((err) => {
        if (err.name !== 'AbortError') setCo2Collection([])
      })
    return () => controller.abort()
  }, [liffProfile?.userId])

  // Use fetched profile data, fallback to LIFF and mock if not available
  const user = {
    name: fetchedProfile?.name || liffProfile?.displayName || MOCK_USER.name,
    lineUsername: fetchedProfile?.displayName || liffProfile?.displayName || userProfile?.displayName || MOCK_USER.displayName,
    gender: fetchedProfile?.gender || MOCK_USER.gender,
    age: fetchedProfile?.age || MOCK_USER.age,
    type: fetchedProfile?.type || MOCK_USER.type,
    subdistrict: fetchedProfile?.subdistrict || MOCK_USER.subdistrict,
    occupation: fetchedProfile?.occupation || MOCK_USER.occupation,
    avatar: fetchedProfile?.avatar || liffProfile?.pictureUrl || userProfile?.pictureUrl || MOCK_USER.avatar,
    phone: fetchedProfile?.phone || '',
  }

  // CO2 and recycled weight come from the points database (total_co2 / total_weight).
  // Trees planted is derived from CO2: ~5 kgCO2 ≈ 1 tree (same formula as the
  // carbon result modal). Zero CO2 → zero trees.
  const stats = {
    co2Reduced: dbCarbon,
    treesPlanted: dbCarbon > 0 ? Math.max(1, Math.ceil(dbCarbon / 5)) : 0,
    totalRecycled: dbWeight,
  }

  // Build the two graph datasets from the real co2_collection rows.
  const graphLoading = !!liffProfile?.userId && co2Collection === null
  const presentKeys = Array.from(new Set((co2Collection ?? []).map((r) => r.waste_type)))
  const orderedKeys = [
    ...WASTE_ORDER.filter((k) => presentKeys.includes(k)),
    ...presentKeys.filter((k) => !WASTE_ORDER.includes(k)),
  ]
  const buildGraph = (field: 'weight' | 'co2') =>
    orderedKeys
      .map((key) => {
        const meta = WASTE_META[key] ?? { label: key, color: '#9aa39a' }
        const total = (co2Collection ?? [])
          .filter((r) => r.waste_type === key)
          .reduce((sum, r) => sum + (Number(r[field]) || 0), 0)
        return { name: meta.label, value: Math.round(total * 100) / 100, color: meta.color }
      })
      .filter((d) => d.value > 0)
  const recycleData = buildGraph('weight')
  const co2Data = buildGraph('co2')

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

  const handleCopyLineId = async () => {
    if (liffProfile?.userId) {
      try {
        await navigator.clipboard.writeText(liffProfile.userId)
        setCopiedLineId(true)
        setTimeout(() => setCopiedLineId(false), 2000)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
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

      {/* Back button */}
      <div className="max-w-md mx-auto px-4 pt-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-[#154212] hover:text-[#154212]/70 transition-colors"
          aria-label="กลับ"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">กลับ</span>
        </button>
      </div>

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

              {/* Row 5: Phone (if available) */}
              {user.phone && (
                <div className="flex">
                  <div className="flex-1">
                    <span className="text-[#666666]">เบอร์โทร</span>
                    <span className="ml-4 text-[#154212] font-medium">{user.phone}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-4 mb-4 shadow-sm">
          <p className="text-sm font-semibold text-[#154212] mb-3">ขอดูโปรไฟล์ (QR Code)</p>
          
          <div className="flex flex-col items-center gap-4">
            {/* QR Code Display */}
            <div className="bg-white p-4 rounded-lg border border-[#e5e5e5] flex justify-center">
              <BrandedQRCode
                value={liffProfile?.userId
                  ? `${typeof window !== 'undefined' ? window.location.origin : 'https://example.com'}/profile-view/${encodeURIComponent(liffProfile.userId)}`
                  : 'https://example.com/profile-view/demo'
                }
                size={200}
              />
            </div>
            
            {/* LINE ID Display and Copy */}
            <div className="w-full">
              <p className="text-xs text-[#666666] mb-1">LINE User ID</p>
              <div className="flex items-center gap-2 bg-[#f5f5f5] rounded-lg p-3">
                <code className="text-sm font-mono text-[#154212] flex-1 break-all">
                  {liffProfile?.userId || 'ไม่พบ User ID'}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyLineId}
                  disabled={!liffProfile?.userId}
                  className="flex-shrink-0"
                >
                  {copiedLineId ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#154212]" />
                  )}
                </Button>
              </div>
              {copiedLineId && (
                <p className="text-xs text-green-600 mt-1">คัดลอกสำเร็จ</p>
              )}
            </div>
            
            <p className="text-xs text-[#999999] text-center">
              แชร์ QR Code นี้เพื่อให้ผู้อื่นเห็นโปรไฟล์ของคุณ
            </p>
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

        {/* Badge Section with Navigation — hidden for now (not deleted) */}
        <div className="hidden bg-white rounded-xl border border-[#e5e5e5] p-4 mb-4 shadow-sm">
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

        {/* Graph - Recycled weight breakdown (KG) */}
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-4 mb-4 shadow-sm">
          <p className="text-sm font-semibold text-[#154212] mb-3">กราฟการสะสมน้ำหนักขยะของคุณ (KG)</p>

          {graphLoading ? (
            <div className="h-40 rounded-xl bg-[#f5f5f5] animate-pulse" />
          ) : recycleData.length === 0 ? (
            <EmptyGraph />
          ) : (
            <>
              <div className="flex justify-center">
                <div className="w-40 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={recycleData}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={72}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {recycleData.map((entry, index) => (
                          <Cell key={`cell-w-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Legend — 2-column grid below the donut */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
                {recycleData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[#666666]">{item.name}</span>
                    <span className="ml-auto font-medium text-[#154212]">{item.value} KG</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Graph - CO2 reduction breakdown + tree equivalent */}
        <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden mb-4 shadow-sm">
          <div className="p-4">
            <p className="text-sm font-semibold text-[#154212] mb-3">กราฟสะสมการลดค่า CO2 ของคุณ</p>

            {graphLoading ? (
              <div className="h-40 rounded-xl bg-[#f5f5f5] animate-pulse" />
            ) : co2Data.length === 0 ? (
              <EmptyGraph />
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-32 h-32 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={co2Data}
                        cx="50%"
                        cy="50%"
                        innerRadius={34}
                        outerRadius={58}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {co2Data.map((entry, index) => (
                          <Cell key={`cell-co2-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend on the right */}
                <div className="flex-1 space-y-1.5">
                  {co2Data.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[#666666]">{item.name}</span>
                      <span className="ml-auto font-medium text-[#154212]">{item.value} kgCO2</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tree illustration + "equivalent trees planted" — only when there's CO2 data */}
          {!graphLoading && co2Data.length > 0 && (
            <div className="relative">
              <div
                className="w-full aspect-[636/407] bg-no-repeat bg-contain bg-bottom"
                style={{ backgroundImage: 'url(/graphtree-bg.svg)' }}
              />
              <div className="absolute bottom-4 right-4 bg-[#eaf6e8]/95 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-md text-center">
                <p className="text-xs font-medium text-[#4a7a4a] mb-1">เทียบเท่าการปลูกต้นไม้</p>
                <p className="text-2xl font-bold text-[#154212] flex items-center justify-center gap-1.5">
                  <TreePine className="w-6 h-6 text-[#6fc061]" />
                  {stats.treesPlanted}
                  <span className="text-sm font-medium">ต้น</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* <BottomNav /> */}
    </div>
  )
}
