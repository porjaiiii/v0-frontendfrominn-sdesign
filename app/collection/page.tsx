'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Zap } from 'lucide-react'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { WasteCollectionCard } from '@/components/waste-collection-card'
import { useRouter } from 'next/navigation'

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

export default function CollectionPage() {
  const router = useRouter()
  const [records, setRecords] = useState<WasteRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<WasteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'done'>('pending')
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    // Get user ID from localStorage or URL params
    const storedUserId = localStorage.getItem('userId') || 'default-user'
    setUserId(storedUserId)
  }, [])

  useEffect(() => {
    const fetchRecords = async () => {
      if (!userId) return

      try {
        setLoading(true)
        const response = await fetch(`/api/waste/records?user_id=${userId}`)

        if (!response.ok) {
          throw new Error('Failed to fetch waste records')
        }

        const data = await response.json()

        // Map records from array format
        const mappedRecords = (data.records || [])
          .filter((record: any) => record[1] === userId)
          .map((record: any) => ({
            timestamp: record[0],
            user_id: record[1],
            waste_type: record[2],
            waste_subtype: record[3],
            weight_kg: parseFloat(record[4]) || 0,
            image_url: record[5],
            carbon_reduction: parseFloat(record[6]) || 0,
            points_earned: parseFloat(record[7]) || 0,
            status: record[8],
          }))

        setRecords(mappedRecords)
      } catch (err) {
        console.error('Error fetching waste records:', err)
        setError('ไม่สามารถดึงข้อมูลได้')
      } finally {
        setLoading(false)
      }
    }

    fetchRecords()
  }, [userId])

  // Filter records based on active filter
  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredRecords(records)
    } else if (activeFilter === 'pending') {
      setFilteredRecords(records.filter(r => r.status === 'pending'))
    } else if (activeFilter === 'done') {
      setFilteredRecords(records.filter(r => r.status === 'done'))
    }
  }, [records, activeFilter])

  const handleConfirmRecord = async (record: WasteRecord) => {
    try {
      // Update the record status to 'done'
      // This would typically call an API to update the backend
      setRecords(records.map(r =>
        r.timestamp === record.timestamp && r.user_id === record.user_id
          ? { ...r, status: 'done' }
          : r
      ))
    } catch (err) {
      console.error('Error confirming record:', err)
    }
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="p-1 rounded-full hover:bg-[#f5f5f5] transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-[#666666]" />
          </Link>
          <h1 className="text-lg font-semibold text-[#154212]">ข้อมูลการสแกน</h1>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'pending', label: 'ยังไม่ยืนยัน' },
            { id: 'done', label: 'เสร็จสิ้น' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id as 'all' | 'pending' | 'done')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === filter.id
                  ? 'bg-[#154212] text-white'
                  : 'bg-[#f5f5f5] text-[#666666] hover:bg-[#e5e5e5]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Summary Stats */}
        {filteredRecords.length > 0 && (
          <div className="bg-[#e8f3e6] border-2 border-[#154212] rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#154212]" />
              <div>
                <p className="text-xs text-[#666666] font-medium">น้ำหนักรวม</p>
                <p className="text-lg font-bold text-[#154212]">
                  {filteredRecords.reduce((sum, r) => sum + r.weight_kg, 0).toFixed(1)} กก.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-[#666666]">กำลังโหลด...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredRecords.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#999999] text-sm">
              {activeFilter === 'pending' && 'ไม่มีรายการที่รอการยืนยัน'}
              {activeFilter === 'done' && 'ยังไม่มีรายการที่เสร็จสิ้น'}
              {activeFilter === 'all' && 'ไม่มีข้อมูลการสแกน'}
            </p>
          </div>
        )}

        {/* Collection Cards List */}
        {!loading && !error && filteredRecords.length > 0 && (
          <div className="space-y-4">
            {filteredRecords.map((record, index) => (
              <WasteCollectionCard
                key={`${record.timestamp}-${record.user_id}`}
                record={record}
                onConfirm={handleConfirmRecord}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
