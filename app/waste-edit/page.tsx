'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, Save } from 'lucide-react'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'

interface WasteRecord {
  timestamp: string
  user_id: string
  waste_type: string
  waste_subtype: string
  weight_kg: number
  image_url: string
  carbon_reduction: number
  points_earned: number
  status: string
}

function WasteEditContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const timestamp = searchParams.get('timestamp')
  const userId = searchParams.get('userId')

  const [record, setRecord] = useState<WasteRecord | null>(null)
  const [formData, setFormData] = useState({
    waste_type: '',
    waste_subtype: '',
    weight_kg: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRecord = async () => {
      if (!timestamp || !userId) {
        setError('ไม่พบข้อมูล')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await fetch(`/api/waste/records?user_id=${userId}`)

        if (!response.ok) {
          throw new Error('Failed to fetch waste records')
        }

        const data = await response.json()

        // Find the record by timestamp
        const foundRecord = (data.records || [])
          .filter((rec: any) => rec[1] === userId)
          .map((rec: any) => ({
            timestamp: rec[0],
            user_id: rec[1],
            waste_type: rec[2],
            waste_subtype: rec[3],
            weight_kg: parseFloat(rec[4]) || 0,
            image_url: rec[5],
            carbon_reduction: parseFloat(rec[6]) || 0,
            points_earned: parseFloat(rec[7]) || 0,
            status: rec[8],
          }))
          .find((rec: WasteRecord) => rec.timestamp === decodeURIComponent(timestamp))

        if (foundRecord) {
          setRecord(foundRecord)
          setFormData({
            waste_type: foundRecord.waste_type,
            waste_subtype: foundRecord.waste_subtype,
            weight_kg: foundRecord.weight_kg,
          })
        } else {
          setError('ไม่พบข้อมูลที่ต้องการแก้ไข')
        }
      } catch (err) {
        console.error('Error fetching record:', err)
        setError('ไม่สามารถดึงข้อมูลได้')
      } finally {
        setLoading(false)
      }
    }

    fetchRecord()
  }, [timestamp, userId])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      // Update the record in backend
      // This would call an API to save changes
      // For now, we'll just update locally and change status to done
      
      console.log('Saving waste record:', {
        ...record,
        ...formData,
        status: 'done',
      })

      // Redirect back to collection page
      router.push('/collection')
    } catch (err) {
      console.error('Error saving record:', err)
      setError('ไม่สามารถบันทึกข้อมูลได้')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-24 flex items-center justify-center">
        <p className="text-[#666666]">กำลังโหลด...</p>
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-white pb-24">
        <PageHeader />
        <main className="max-w-md mx-auto px-4 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center text-red-600 text-sm">
            {error || 'ไม่พบข้อมูล'}
          </div>
          <Link
            href="/collection"
            className="mt-4 inline-flex items-center gap-2 text-[#154212] font-medium"
          >
            <ChevronLeft size={20} />
            <span>กลับไปยังรายการ</span>
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/collection"
            className="p-1 rounded-full hover:bg-[#f5f5f5] transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-[#666666]" />
          </Link>
          <h1 className="text-lg font-semibold text-[#154212]">แก้ไขข้อมูลขยะ</h1>
        </div>

        {/* Image Display */}
        {record.image_url && (
          <div className="mb-6 rounded-2xl overflow-hidden h-48 bg-gray-100 flex items-center justify-center border-2 border-[#d4d4d4]">
            <Image
              src={record.image_url}
              alt={`${record.waste_type} - ${record.waste_subtype}`}
              width={400}
              height={300}
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.target as HTMLImageElement
                img.style.display = 'none'
              }}
            />
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-5">
          {/* Waste Type */}
          <div>
            <label className="text-xs text-[#666666] font-medium mb-2 block">
              ประเภทขยะ
            </label>
            <input
              type="text"
              value={formData.waste_type}
              onChange={(e) => handleInputChange('waste_type', e.target.value)}
              className="w-full bg-white border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold focus:outline-none focus:border-[#154212]"
              placeholder="ประเภทขยะ"
            />
          </div>

          {/* Waste Subtype */}
          <div>
            <label className="text-xs text-[#666666] font-medium mb-2 block">
              ประเภทย่อย
            </label>
            <input
              type="text"
              value={formData.waste_subtype}
              onChange={(e) => handleInputChange('waste_subtype', e.target.value)}
              className="w-full bg-white border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold focus:outline-none focus:border-[#154212]"
              placeholder="ประเภทย่อย"
            />
          </div>

          {/* Weight */}
          <div>
            <label className="text-xs text-[#666666] font-medium mb-2 block">
              น้ำหนัก (กิโลกรัม)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.weight_kg}
              onChange={(e) => handleInputChange('weight_kg', parseFloat(e.target.value) || 0)}
              className="w-full bg-white border-2 border-[#d4d4d4] rounded-lg px-4 py-3 text-[#154212] font-semibold focus:outline-none focus:border-[#154212]"
              placeholder="0.00"
            />
          </div>

          {/* Read-only Info */}
          <div className="bg-[#f5f5f5] rounded-lg p-4 space-y-2">
            <p className="text-xs text-[#666666] font-medium">ข้อมูลเพิ่มเติม</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[#999999]">คาร์บอนลดลง</p>
                <p className="font-semibold text-[#154212]">{record.carbon_reduction.toFixed(1)} kg CO2</p>
              </div>
              <div>
                <p className="text-[#999999]">คะแนน</p>
                <p className="font-semibold text-[#154212]">+{record.points_earned}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-8">
          <Link
            href="/collection"
            className="flex-1 px-4 py-3 border-2 border-[#d4d4d4] text-[#666666] font-semibold rounded-xl hover:bg-gray-50 transition-colors text-center"
          >
            ยกเลิก
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#154212] text-white font-semibold rounded-xl hover:bg-[#0f300c] transition-colors disabled:opacity-50"
          >
            <Save size={20} />
            <span>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

export default function WasteEditPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white pb-24 flex items-center justify-center">
        <p className="text-[#666666]">กำลังโหลด...</p>
      </div>
    }>
      <WasteEditContent />
    </Suspense>
  )
}
