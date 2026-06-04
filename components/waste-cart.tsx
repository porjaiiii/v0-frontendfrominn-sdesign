'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Leaf, Trash2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WasteDetailModal } from './waste-detail-modal'

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

const WASTE_TYPE_COLORS: Record<string, string> = {
  plastic: 'bg-[#e8f3e6] text-[#154212]',
  paper: 'bg-[#fff4e6] text-[#8b6f47]',
  glass: 'bg-[#e8f0f7] text-[#1a4d8f]',
  aluminum: 'bg-[#f0f0f0] text-[#666666]',
  oil: 'bg-[#fff9e6] text-[#c4a300]',
}

export function WasteCart({ userId, onTotalWeightChange }: WasteCartProps) {
  const [records, setRecords] = useState<WasteRecord[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalWeight, setTotalWeight] = useState(0)
  const [selectedRecord, setSelectedRecord] = useState<WasteRecord | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

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
        
        // Filter records สำหรับ user นี้เท่านั้น
        const filteredRecords = (data.records || []).filter(
          (record: any) => record[1] === userId  // Index 1 คือ user_id จากชีท
        )
        
        console.log('[v0] Filtered records count:', filteredRecords.length)
        console.log('[v0] Original records count:', data.records?.length)
        
        // Map records จาก array format ใน Google Sheet
        const mappedRecords = filteredRecords.map((record: any) => ({
          timestamp: record[0],
          user_id: record[1],
          waste_type: record[2],
          waste_subtype: record[3],
          weight_kg: parseFloat(record[4]) || 0,
          image_url: record[5],
          carbon_reduction: parseFloat(record[6]) || 0,
          points_earned: parseFloat(record[7]) || 0,
          status: record[8],
          notes: record[9],
        }))
        
        // Calculate total weight
        const calculatedTotal = mappedRecords.reduce((sum, r) => sum + r.weight_kg, 0)
        setTotalWeight(calculatedTotal)
        if (onTotalWeightChange) {
          onTotalWeightChange(calculatedTotal)
        }
        
        setRecords(mappedRecords)
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

  const handleConfirmRecord = async (record: WasteRecord) => {
    try {
      setIsConfirming(true)
      console.log('[v0] Confirming waste record:', record)
      
      // Remove the record from the list
      setRecords(records.filter(r => 
        !(r.timestamp === record.timestamp && r.user_id === record.user_id)
      ))
      
      // Recalculate total weight
      const newRecords = records.filter(r => 
        !(r.timestamp === record.timestamp && r.user_id === record.user_id)
      )
      const newTotal = newRecords.reduce((sum, r) => sum + r.weight_kg, 0)
      setTotalWeight(newTotal)
      if (onTotalWeightChange) {
        onTotalWeightChange(newTotal)
      }
      
      // Close modal
      setIsModalOpen(false)
      setSelectedRecord(null)
    } catch (err) {
      console.error('[v0] Error confirming record:', err)
    } finally {
      setIsConfirming(false)
    }
  }

  const handleOpenDetails = (record: WasteRecord) => {
    setSelectedRecord(record)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedRecord(null)
  }

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
      {/* Detail Modal */}
      <WasteDetailModal
        record={selectedRecord}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmRecord}
        isConfirming={isConfirming}
      />

      {/* Stats Summary */}
      {stats && (
        <div className="bg-white rounded-2xl overflow-hidden border border-[#e5e5e5]">
          <div className="grid grid-cols-2">
            {/* CO2 Card */}
            <div className="p-5 border-r border-[#e5e5e5] flex flex-col items-center justify-center text-center">
              <div className="flex justify-center mb-2">
                <Leaf size={20} className="text-[#154212]" />
              </div>
              <p className="text-xs text-[#666666] font-medium mb-2">คำนวณแอลจี</p>
              <p className="text-2xl font-bold text-[#154212]">
                {stats.total_carbon?.toFixed(1) || 0}
              </p>
              <p className="text-xs text-[#666666] mt-1">kg CO2</p>
            </div>

            {/* Weight Card */}
            <div className="p-5 flex flex-col items-center justify-center text-center">
              <div className="flex justify-center mb-2">
                <Trash2 size={20} className="text-[#154212]" />
              </div>
              <p className="text-xs text-[#666666] font-medium mb-2">น้ำหนักรวม</p>
              <p className="text-2xl font-bold text-[#154212]">
                {stats.total_weight?.toFixed(1) || 0}
              </p>
              <p className="text-xs text-[#666666] mt-1">kg</p>
            </div>
          </div>
        </div>
      )}

      {/* Records List */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#e5e5e5]">
        <div className="p-4 border-b border-[#e5e5e5]">
          <h3 className="font-bold text-lg text-[#154212]">
            รายการขยะ ({records.length})
          </h3>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[#999999]">ยังไม่มีการบันทึกขยะ</p>
          </div>
        ) : (
          <div className="divide-y divide-[#e5e5e5]">
            {records.map((record, index) => (
              <div key={index} className="p-4">
                {record.image_url && (
                  <div className="mb-3 rounded-lg overflow-hidden h-32 bg-gray-100 flex items-center justify-center border-2 border-[#154212]">
                    <Image
                      src={record.image_url}
                      alt={`${record.waste_type} - ${record.waste_subtype}`}
                      width={300}
                      height={200}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement
                        img.style.display = 'none'
                        const parent = img.parentElement
                        if (parent) {
                          const placeholder = document.createElement('div')
                          placeholder.className = 'flex flex-col items-center justify-center gap-2'
                          placeholder.innerHTML = '<svg class="w-12 h-12 text-[#154212]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
                          parent.appendChild(placeholder)
                        }
                      }}
                    />
                  </div>
                )}

                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span
                      className={cn(
                        'inline-block px-3 py-1 rounded-full text-xs font-semibold',
                        WASTE_TYPE_COLORS[record.waste_type] ||
                          'bg-[#f0f0f0] text-[#666666]'
                      )}
                    >
                      {record.waste_type}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[#154212]">
                    +{record.points_earned} คะแนน
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-[#666666] mb-4">
                  <div>
                    <p className="text-[#999999]">น้ำหนัก</p>
                    <p className="font-semibold text-[#154212]">
                      {record.weight_kg} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-[#999999]">คาร์บอน</p>
                    <p className="font-semibold text-[#154212]">
                      {(record.carbon_reduction ?? 0).toFixed(1)} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-[#999999]">วันเวลา</p>
                    <p className="font-semibold text-[#154212] text-xs">
                      {new Date(record.timestamp).toLocaleDateString('th-TH', {
                        month: 'short',
                        day: 'numeric',
                      })} {new Date(record.timestamp).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleOpenDetails(record)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white text-[#154212] font-semibold rounded-lg hover:bg-[#f0f9e8] transition-colors border-2 border-[#154212]"
                >
                  <span>ดูรายละเอียด</span>
                  <ChevronRight size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
