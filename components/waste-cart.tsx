'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Trash2, Check, Edit3 } from 'lucide-react'
import { cn } from '@/lib/utils'

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

interface WasteCartProps {
  userId: string
  onTotalWeightChange?: (weight: number) => void
}

const WASTE_TYPE_ICONS: Record<string, string> = {
  plastic: '🔴',
  paper: '📄',
  glass: '🔵',
  aluminum: '⚪',
  oil: '🟡',
}

const WASTE_TYPE_COLORS: Record<string, string> = {
  plastic: 'bg-red-100 text-red-700',
  paper: 'bg-yellow-100 text-yellow-700',
  glass: 'bg-blue-100 text-blue-700',
  aluminum: 'bg-gray-100 text-gray-700',
  oil: 'bg-amber-100 text-amber-700',
}

export function WasteCart({ userId, onTotalWeightChange }: WasteCartProps) {
  const router = useRouter()
  const [records, setRecords] = useState<WasteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalWeight, setTotalWeight] = useState(0)
  const [activeFilter, setActiveFilter] = useState('all')
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        console.log('[v0] Fetching waste records for userId:', userId)
        setLoading(true)
        const response = await fetch(`/api/waste/records?user_id=${userId}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch waste records')
        }

        const data = await response.json()
        
        const filteredRecords = (data.records || []).filter(
          (record: any) => record[1] === userId
        )
        
        const mappedRecords = filteredRecords.map((record: any) => ({
          timestamp: record[0],
          user_id: record[1],
          waste_type: record[2],
          waste_subtype: record[3],
          weight_kg: parseFloat(record[4]) || 0,
          image_url: record[5],
          carbon_reduction: parseFloat(record[6]) || 0,
          points_earned: parseFloat(record[7]) || 0,
          status: record[8] || 'pending',
          notes: record[9],
        }))
        
        const calculatedTotal = mappedRecords.reduce((sum, r) => sum + r.weight_kg, 0)
        setTotalWeight(calculatedTotal)
        if (onTotalWeightChange) {
          onTotalWeightChange(calculatedTotal)
        }
        
        setRecords(mappedRecords)
      } catch (err) {
        console.error('[v0] Error fetching waste records:', err)
        setError('ไม่สามารถดึงข้อมูลขยะได้')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchRecords()
    }
  }, [userId])

  const handleConfirm = async (record: WasteRecord) => {
    try {
      setConfirming(record.timestamp)
      console.log('[v0] Confirming waste record:', record.waste_type)
      
      const response = await fetch(`/api/waste/records`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: record.timestamp,
          user_id: record.user_id,
          status: 'done'
        })
      })

      if (response.ok) {
        setRecords(records.filter(r => r.timestamp !== record.timestamp))
        
        const newTotal = records
          .filter(r => r.timestamp !== record.timestamp)
          .reduce((sum, r) => sum + r.weight_kg, 0)
        setTotalWeight(newTotal)
        if (onTotalWeightChange) {
          onTotalWeightChange(newTotal)
        }
      }
    } catch (err) {
      console.error('[v0] Error confirming record:', err)
    } finally {
      setConfirming(null)
    }
  }

  const handleEdit = (record: WasteRecord) => {
    router.push(`/waste-edit?timestamp=${encodeURIComponent(record.timestamp)}&userId=${encodeURIComponent(userId)}`)
  }

  const filteredRecords = activeFilter === 'all' 
    ? records 
    : records.filter(r => r.status === activeFilter)

  if (loading) {
    return (
      <div className="p-4 bg-white rounded-2xl">
        <p className="text-center text-gray-500">กำลังโหลดข้อมูล...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-2xl">
        <p className="text-center text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="bg-white rounded-xl border border-[#e5e5e5] p-3 flex gap-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={cn(
            'px-4 py-2 rounded-lg font-semibold text-sm transition-colors',
            activeFilter === 'all'
              ? 'bg-[#154212] text-white'
              : 'bg-[#f0f0f0] text-[#666666] hover:bg-[#e5e5e5]'
          )}
        >
          ทั้งหมด ({records.length})
        </button>
        <button
          onClick={() => setActiveFilter('pending')}
          className={cn(
            'px-4 py-2 rounded-lg font-semibold text-sm transition-colors',
            activeFilter === 'pending'
              ? 'bg-[#ffb800] text-white'
              : 'bg-[#fff9e6] text-[#c4a300] hover:bg-[#ffe6b3]'
          )}
        >
          ยังไม่ยืนยัน ({records.filter(r => r.status === 'pending').length})
        </button>
        <button
          onClick={() => setActiveFilter('done')}
          className={cn(
            'px-4 py-2 rounded-lg font-semibold text-sm transition-colors',
            activeFilter === 'done'
              ? 'bg-[#4caf50] text-white'
              : 'bg-[#e8f5e9] text-[#2e7d32] hover:bg-[#c8e6c9]'
          )}
        >
          เสร็จสิ้น ({records.filter(r => r.status === 'done').length})
        </button>
      </div>

      {/* Collection Cards */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-8 text-center">
          <p className="text-[#999999] font-medium">
            {activeFilter === 'all' ? 'ไม่มีรายการขยะ' : 'ไม่มีรายการในหมวดหมู่นี้'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => (
            <div key={record.timestamp} className="bg-white rounded-xl border border-[#e5e5e5] p-4 shadow-sm hover:shadow-md transition-shadow">
              {/* Top Row - Image and Info */}
              <div className="flex gap-4 mb-4">
                {/* Left Square - Image */}
                <div className="w-24 h-24 flex-shrink-0 rounded-lg border-2 border-[#ddd] overflow-hidden bg-gray-50 flex items-center justify-center">
                  {record.image_url ? (
                    <Image
                      src={record.image_url}
                      alt={record.waste_type}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                      onError={() => {
                        console.log('[v0] Image load error')
                      }}
                    />
                  ) : (
                    <Trash2 className="w-8 h-8 text-[#999999]" />
                  )}
                </div>

                {/* Center Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{WASTE_TYPE_ICONS[record.waste_type] || '♻️'}</span>
                    <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', WASTE_TYPE_COLORS[record.waste_type])}>
                      {record.waste_type}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 text-[#666666]">
                    <p><span className="font-semibold">ประเภทย่อย:</span> {record.waste_subtype}</p>
                    <p><span className="font-semibold">น้ำหนัก:</span> {record.weight_kg} kg</p>
                    <p className="text-[#999999] text-xs">
                      {new Date(record.timestamp).toLocaleDateString('th-TH')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Buttons Row */}
              <div className="flex gap-3 pt-3 border-t border-[#e5e5e5]">
                <button
                  onClick={() => handleEdit(record)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#f0f0f0] text-[#154212] font-semibold rounded-lg hover:bg-[#e5e5e5] transition-colors text-sm"
                  disabled={confirming === record.timestamp}
                >
                  <Edit3 size={16} />
                  แก้ไข
                </button>
                <button
                  onClick={() => handleConfirm(record)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#154212] text-white font-semibold rounded-lg hover:bg-[#154212]/90 transition-colors text-sm disabled:opacity-50"
                  disabled={confirming === record.timestamp}
                >
                  <Check size={16} />
                  {confirming === record.timestamp ? 'กำลังยืนยัน...' : 'ยืนยัน'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
