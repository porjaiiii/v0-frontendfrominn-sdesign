'use client'

import { useEffect, useState } from 'react'
import { WasteDetailModal } from './waste-detail-modal'
import { WasteCard } from './waste-card'

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

export function WasteCart({ userId, onTotalWeightChange }: WasteCartProps) {
  const [records, setRecords] = useState<WasteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalWeight, setTotalWeight] = useState(0)
  const [selectedRecord, setSelectedRecord] = useState<WasteRecord | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [savingRecordId, setSavingRecordId] = useState<string | null>(null)
  const [isEditingMode, setIsEditingMode] = useState(false)

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
        
        console.log('[v0] Mapped records:', mappedRecords)
        mappedRecords.forEach((record, idx) => {
          console.log(`[v0] Record ${idx}:`, {
            type: record.waste_type,
            weight: record.weight_kg,
            imageUrl: record.image_url,
            status: record.status
          })
        })
        
        // Calculate total weight
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

  const handleEditRecord = (record: WasteRecord, isEditing: boolean) => {
    // Open modal in edit mode
    setSelectedRecord(record)
    setIsModalOpen(true)
    setIsEditingMode(isEditing)
  }

  const handleSaveRecord = async (record: WasteRecord) => {
    try {
      const recordId = `${record.timestamp}-${record.user_id}`
      setSavingRecordId(recordId)
      console.log('[v0] Saving waste record (update status to done):', record)
      
      // Call API to update record - change status from pending to done
      const response = await fetch('/api/waste/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('[v0] API error:', error)
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + (error.error || 'Unknown error'))
        return
      }

      const result = await response.json()
      console.log('[v0] Save API response:', result)
      
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
    } catch (err) {
      console.error('[v0] Error saving record:', err)
      alert('เกิดข้อผิดพลาด: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setSavingRecordId(null)
    }
  }

  const handleOpenDetails = (record: WasteRecord) => {
    setSelectedRecord(record)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedRecord(null)
    setIsEditingMode(false)
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

  const pendingRecords = records.filter(r => r.status === 'pending')

  return (
    <div className="space-y-3">
      {/* Detail Modal */}
      <WasteDetailModal
        record={selectedRecord}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmRecord}
        isConfirming={isConfirming}
        isEditing={isEditingMode}
      />

      {pendingRecords.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[#999999]">ยังไม่มีรายการขยะที่รอยืนยัน</p>
        </div>
      ) : (
        pendingRecords.map((record, index) => (
          <WasteCard
            key={index}
            record={record}
            onEdit={handleEditRecord}
            onSave={handleSaveRecord}
            isSaving={savingRecordId === `${record.timestamp}-${record.user_id}`}
          />
        ))
      )}
    </div>
  )
}
