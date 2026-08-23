'use client'

import { useEffect, useState } from 'react'
import { WasteDetailModal } from './waste-detail-modal'
import { WasteCard } from './waste-card'
import { apiFetch, useIdempotencyKey } from '@/lib/api-client'
import type { WasteRecord } from '@/lib/waste-records'

interface WasteCartProps {
  userId: string
  onTotalWeightChange?: (weight: number) => void
  sortMode?: 'date' | 'weight'
}

export function WasteCart({ userId, onTotalWeightChange, sortMode = 'date' }: WasteCartProps) {
  const [records, setRecords] = useState<WasteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalWeight, setTotalWeight] = useState(0)
  const [selectedRecord, setSelectedRecord] = useState<WasteRecord | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [savingRecordId, setSavingRecordId] = useState<string | null>(null)
  const [isEditingMode, setIsEditingMode] = useState(false)
  const saveKey = useIdempotencyKey()

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/waste/records?user_id=${userId}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch waste records')
        }

        const data = await response.json()
        
        // The route returns typed, user-scoped records. The array-of-arrays
        // parsing that used to be hand-inlined here is lib/waste-records.ts,
        // which now runs once server-side.
        const mappedRecords: WasteRecord[] = data.records ?? []
        setRecords(mappedRecords)

        // 🌟 แก้ไขจุดที่ 1: คำนวณน้ำหนักรวมเฉพาะรายการที่เป็น pending และค่าน้ำหนักต้องไม่ใช่ -1
        const calculatedTotal = mappedRecords
          .filter((r: WasteRecord) => r.status === 'pending' && r.weight_kg !== -1)
          .reduce((sum: number, r: WasteRecord) => sum + r.weight_kg, 0)
        
        setTotalWeight(calculatedTotal)
        if (onTotalWeightChange) {
          onTotalWeightChange(calculatedTotal)
        }
      } catch (err) {
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
      
      const newRecords = records.filter(r => 
        !(r.timestamp === record.timestamp && r.user_id === record.user_id)
      )
      setRecords(newRecords)
      
      // 🌟 แก้ไขจุดที่ 2: อัปเดตค่าน้ำหนักรวมหลังกดยืนยัน (กรอง -1 ออกด้วย)
      const newTotal = newRecords
        .filter(r => r.status === 'pending' && r.weight_kg !== -1)
        .reduce((sum, r) => sum + r.weight_kg, 0)
      
      setTotalWeight(newTotal)
      if (onTotalWeightChange) {
        onTotalWeightChange(newTotal)
      }
      
      setIsModalOpen(false)
      setSelectedRecord(null)
    } catch (err) {
      // silent
    } finally {
      setIsConfirming(false)
    }
  }

  const handleEditRecord = (record: WasteRecord, isEditing: boolean) => {
    setSelectedRecord(record)
    setIsModalOpen(true)
    setIsEditingMode(isEditing)
  }

  const handleSaveRecord = async (record: WasteRecord) => {
    console.log('ข้อมูลที่ส่งไป API:', record)
    try {
      const recordId = `${record.timestamp}-${record.user_id}`
      setSavingRecordId(recordId)
      
      const response = await apiFetch('/api/waste/update', {
        method: 'PUT',
        idempotencyKey: saveKey.current(),
        body: JSON.stringify(record),
      })
      const resData = await response.json()
    console.log('ผลลัพธ์จาก API:', resData)

      if (!response.ok) {
        // The body was already consumed above; re-reading it throws.
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + (resData?.error || 'Unknown error'))
        return
      }

      saveKey.reset()

      const newRecords = records.filter(r => 
        !(r.timestamp === record.timestamp && r.user_id === record.user_id)
      )
      setRecords(newRecords)

      // 🌟 แก้ไขจุดที่ 3: อัปเดตค่าน้ำหนักรวมหลังเซฟเสร็จ (กรอง -1 ออกด้วย)
      const newTotal = newRecords
        .filter(r => r.status === 'pending' && r.weight_kg !== -1)
        .reduce((sum, r) => sum + r.weight_kg, 0)
      
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

  const sortedRecords = [...pendingRecords].sort((a, b) => {
    if (sortMode === 'weight') {
      return b.weight_kg - a.weight_kg
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  return (
    <div className="space-y-3">
      <WasteDetailModal
        record={selectedRecord}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmRecord}
        isConfirming={isConfirming}
        isEditing={isEditingMode}
      />

      {sortedRecords.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[#999999]">ยังไม่มีรายการขยะที่รอยืนยัน</p>
        </div>
      ) : (
        sortedRecords.map((record, index) => (
          <WasteCard
            key={index}
            record={record}
            onEdit={handleEditRecord}
            onSave={handleSaveRecord}
            isSaving={savingRecordId === `${record.timestamp}-${record.user_id}`}
            isAnySaving={savingRecordId !== null}
          />
        ))
      )}
    </div>
  )
}