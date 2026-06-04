'use client'

import { useEffect, useState } from 'react'
import { Leaf, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WasteRecord {
  timestamp: string
  user_id: string
  waste_type: string
  waste_subtype: string
  weight_kg: number
  carbon_reduction: number
  points_earned: number
  status: string
}

interface WasteCartProps {
  userId: string
}

const WASTE_TYPE_COLORS: Record<string, string> = {
  plastic: 'bg-blue-100 text-blue-800',
  paper: 'bg-amber-100 text-amber-800',
  glass: 'bg-cyan-100 text-cyan-800',
  aluminum: 'bg-gray-100 text-gray-800',
  oil: 'bg-yellow-100 text-yellow-800',
}

export function WasteCart({ userId }: WasteCartProps) {
  const [records, setRecords] = useState<WasteRecord[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        console.log('[v0] Fetching waste records for userId:', userId)
        setLoading(true)
        const response = await fetch(`/api/waste/records?user_id=${userId}`)
        
        console.log('[v0] API response status:', response.status)
        
        if (!response.ok) {
          throw new Error('Failed to fetch waste records')
        }

        const data = await response.json()
        console.log('[v0] Waste records data received:', data)
        setRecords(data.records || [])
        setStats(data.stats || null)
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
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Leaf size={18} className="text-green-700" />
              <p className="text-xs text-green-700 font-medium">คาร์บอนลดลง</p>
            </div>
            <p className="text-2xl font-bold text-green-800">
              {stats.total_carbon?.toFixed(1) || 0}
            </p>
            <p className="text-xs text-green-600 mt-1">kg CO2</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 size={18} className="text-blue-700" />
              <p className="text-xs text-blue-700 font-medium">น้ำหนักรวม</p>
            </div>
            <p className="text-2xl font-bold text-blue-800">
              {stats.total_weight?.toFixed(1) || 0}
            </p>
            <p className="text-xs text-blue-600 mt-1">kg</p>
          </div>
        </div>
      )}

      {/* Records List */}
      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-800">
            รายการขยะ ({records.length})
          </h3>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">ยังไม่มีการบันทึกขยะ</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {records.map((record, index) => (
              <div key={index} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span
                      className={cn(
                        'inline-block px-3 py-1 rounded-full text-xs font-semibold',
                        WASTE_TYPE_COLORS[record.waste_type] ||
                          'bg-gray-100 text-gray-800'
                      )}
                    >
                      {record.waste_type}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-green-600">
                    +{record.points_earned} คะแนน
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-2">
                  <div>
                    <p className="text-gray-500">น้ำหนัก</p>
                    <p className="font-semibold text-gray-800">
                      {record.weight_kg} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">คาร์บอน</p>
                    <p className="font-semibold text-gray-800">
                      {record.carbon_reduction.toFixed(1)} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">วันที่</p>
                    <p className="font-semibold text-gray-800">
                      {new Date(record.timestamp).toLocaleDateString('th-TH', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
