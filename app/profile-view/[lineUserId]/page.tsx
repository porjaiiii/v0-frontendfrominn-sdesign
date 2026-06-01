'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { Award, TreePine, ChevronLeft, AlertCircle } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'

export default function ProfileViewPage() {
  const params = useParams()
  const lineUserId = decodeURIComponent(params.lineUserId as string)
  
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentBadgeIndex, setCurrentBadgeIndex] = useState(0)

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
        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-6 shadow-sm text-center space-y-3">
          {profile.avatar && (
            <div className="w-24 h-24 rounded-full overflow-hidden mx-auto border-4 border-[#154212]">
              <Image
                src={profile.avatar}
                alt={profile.name}
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <div>
            <h1 className="text-lg font-bold text-[#154212]">{profile.name}</h1>
            <p className="text-sm text-[#666666]">
              {profile.age && `${profile.age} | `}
              {profile.gender || 'ไม่ระบุ'}
            </p>
          </div>
          
          {profile.subdistrict && (
            <p className="text-sm text-[#999999]">{profile.subdistrict}</p>
          )}
          
          {profile.occupation && (
            <p className="text-sm font-semibold text-[#154212]">{profile.occupation}</p>
          )}
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* CO2 Reduction */}
          <div className="bg-[#6fc061] rounded-xl p-4 text-white shadow-sm">
            <div className="text-3xl font-bold">{profile.co2Reduced || 0}</div>
            <div className="text-xs font-semibold mt-1">kgCO2</div>
            <div className="text-xs opacity-90 mt-1">ลดก๊าซคาร์บอน</div>
          </div>
          
          {/* Trees Planted */}
          <div className="bg-[#27ae60] rounded-xl p-4 text-white shadow-sm">
            <div className="text-3xl font-bold">{profile.treesPlanted || 0}</div>
            <div className="text-xs font-semibold mt-1">ต้น</div>
            <div className="text-xs opacity-90 mt-1">ปลูกต้นไม้</div>
          </div>
        </div>

        {/* Recycled Items */}
        {profile.totalRecycled !== undefined && (
          <div className="bg-white rounded-xl border border-[#e5e5e5] p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#154212] mb-3">รีไซเคิลทั้งหมด</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#666666]">รวม</span>
                <span className="text-lg font-bold text-[#154212]">{profile.totalRecycled} kg</span>
              </div>
              <div className="w-full bg-[#e5e5e5] rounded-full h-2">
                <div 
                  className="bg-[#6fc061] h-2 rounded-full"
                  style={{ width: '45%' }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Recycling Breakdown Chart */}
        {profile.recycleData && profile.recycleData.length > 0 && (
          <div className="bg-white rounded-xl border border-[#e5e5e5] p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#154212] mb-3 text-center">การรีไซเคิลตามประเภท</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={profile.recycleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {profile.recycleData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {profile.recycleData.map((item: any) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-xs text-[#666666]">{item.name}: {item.value}kg</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CO2 Reduction Breakdown Chart */}
        {profile.co2Data && profile.co2Data.length > 0 && (
          <div className="bg-white rounded-xl border border-[#e5e5e5] p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#154212] mb-3 text-center">ลดก๊าซคาร์บอนตามประเภท</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={profile.co2Data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {profile.co2Data.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {profile.co2Data.map((item: any) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-xs text-[#666666]">{item.name}: {item.value}kg</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
