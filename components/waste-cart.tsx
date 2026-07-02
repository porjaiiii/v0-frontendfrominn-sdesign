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
  image_urls: string[] // รองรับหลายรูปภาพตาม GAS
  carbon_reduction: number
  points_earned: number
  status: string
  notes?: string
}

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

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/waste/records?user_id=${userId}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch waste records')
        }

        const data = await response.json()
        
        // Filter records สำหรับ user นี้เท่านั้น
        const filteredRecords = (data.records || []).filter(
          (record: any) => record[1] === userId
        )
        
        // Map records จาก array format ใน Google Sheet
        const mappedRecords = filteredRecords.map((record: any) => {
  let parsedImageUrls: string[] = []
  const rawImageData = record[5] // คอลัมน์ F ใน Google Sheet
  
  if (rawImageData) {
    // กรณีที่ 1: ถ้าเป็น JSON Array (มี [] ครอบ)
    if (typeof rawImageData === 'string' && rawImageData.startsWith('[') && rawImageData.endsWith(']')) {
      try {
        parsedImageUrls = JSON.parse(rawImageData)
      } catch (e) {
        parsedImageUrls = [rawImageData]
      }
    } 
    // 🌟 กรณีที่ 2: ถ้าเป็น String ที่มี comma คั่น (เช่น "url1,url2")
    else if (typeof rawImageData === 'string' && rawImageData.includes(',')) {
      parsedImageUrls = rawImageData.split(',').map(url => url.trim())
    }
    // กรณีที่ 3: มีแค่ลิงก์เดียว หรือข้อมูลปกติ
    else {
      parsedImageUrls = [rawImageData]
    }
  }

  return {
    timestamp: record[0],
    user_id: record[1],
    waste_type: record[2],
    waste_subtype: record[3],
    weight_kg: parseFloat(record[4]) || 0,
    image_urls: parsedImageUrls, // ตอนนี้จะได้เป็น ["url1", "url2"] ที่ถูกต้อง
    carbon_reduction: parseFloat(record[6]) || 0,
    points_earned: parseFloat(record[7]) || 0,
    status: record[8],
    notes: record[9],
  }
})
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
    try {
      const recordId = `${record.timestamp}-${record.user_id}`
      setSavingRecordId(recordId)
      
      const response = await fetch('/api/waste/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      })

      if (!response.ok) {
        const error = await response.json()
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + (error.error || 'Unknown error'))
        return
      }

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
          />
        ))
      )}
    </div>
  )
}