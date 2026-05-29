'use client'

import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { ChevronLeft, MoreVertical, Recycle, Gift, Coins } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// Filter tabs
const FILTERS = [
  { id: 'all', label: 'ทั้งหมด', icon: null },
  { id: 'recycle', label: 'รีไซเคิล', icon: Recycle, color: 'bg-[#b6ebad]' },
  { id: 'reward', label: 'แลกรางวัล', icon: Gift, color: 'bg-[#f9e7b0]' },
  { id: 'points', label: 'คะแนน', icon: Coins, color: 'bg-[#89b9ea]' },
]

// Mock history data with time
const historyData = [
  {
    id: '1',
    date: '27 พฤษภาคม 2569',
    time: '14:30',
    type: 'points',
    title: 'คุณมีคะแนนสะสมเพิ่ม 21 คะแนน',
    color: 'bg-[#b6ebad]',
  },
  {
    id: '2',
    date: '27 พฤษภาคม 2569',
    time: '12:15',
    type: 'recycle',
    title: 'เก็บของรีไซเคิล 7.95 KG',
    color: 'bg-[#f9e7b0]',
    hasDetail: true,
  },
  {
    id: '3',
    date: '27 พฤษภาคม 2569',
    time: '10:00',
    type: 'reward',
    title: 'แลกรางวัลจากคะแนน 35 คะแนน',
    color: 'bg-[#89b9ea]',
  },
  {
    id: '4',
    date: '27 พฤษภาคม 2569',
    time: '09:30',
    type: 'points',
    title: 'คุณมีคะแนนสะสมเพิ่ม 21 คะแนน',
    color: 'bg-[#b6ebad]',
  },
  {
    id: '5',
    date: '26 พฤษภาคม 2569',
    time: '16:45',
    type: 'recycle',
    title: 'เก็บของรีไซเคิล 7.95 KG',
    color: 'bg-[#f9e7b0]',
    hasDetail: true,
  },
  {
    id: '6',
    date: '26 พฤษภาคม 2569',
    time: '11:20',
    type: 'points',
    title: 'คุณมีคะแนนสะสมเพิ่ม 21 คะแนน',
    color: 'bg-[#b6ebad]',
  },
  {
    id: '7',
    date: '25 พฤษภาคม 2569',
    time: '08:00',
    type: 'recycle',
    title: 'เก็บของรีไซเคิล 7.95 KG',
    color: 'bg-[#f9e7b0]',
    hasDetail: true,
  },
]

// Group data by date
function groupByDate(data: typeof historyData) {
  const groups: { [key: string]: typeof historyData } = {}
  data.forEach(item => {
    if (!groups[item.date]) {
      groups[item.date] = []
    }
    groups[item.date].push(item)
  })
  return groups
}

// Format time to Thai style
function formatTime(time: string) {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  return `${hour}.${minutes} น.`
}

export default function HistoryPage() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState('all')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const filteredData = activeFilter === 'all' 
    ? historyData 
    : historyData.filter(item => item.type === activeFilter)

  const groupedData = groupByDate(filteredData)

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Back Button and Title */}
        <div className="flex items-center gap-2 mb-4">
          <button 
            onClick={() => router.back()}
            className="p-1 rounded-full hover:bg-[#f5f5f5]"
          >
            <ChevronLeft className="w-6 h-6 text-[#666666]" />
          </button>
          <h1 className="text-lg font-semibold text-[#154212]">การใช้งานย้อนหลัง</h1>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                activeFilter === filter.id
                  ? 'bg-[#154212] text-white'
                  : 'bg-[#f5f5f5] text-[#666666] hover:bg-[#e5e5e5]'
              )}
            >
              {filter.icon && (
                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center', filter.color)}>
                  <filter.icon className="w-3 h-3 text-[#154212]" />
                </div>
              )}
              {filter.label}
            </button>
          ))}
        </div>

        {/* History List Grouped by Date */}
        <div className="space-y-6">
          {Object.entries(groupedData).map(([date, items]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#154212]" />
                <h2 className="text-sm font-semibold text-[#154212]">{date}</h2>
              </div>

              {/* Timeline Items */}
              <div className="ml-[3px] border-l-2 border-[#e5e5e5] pl-5 space-y-3">
                {items.map((item, index) => (
                  <div 
                    key={item.id}
                    className="relative"
                  >
                    {/* Timeline dot */}
                    <div className="absolute -left-[25px] top-3 w-3 h-3 rounded-full bg-white border-2 border-[#154212]" />
                    
                    {/* Card */}
                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#e5e5e5]">
                      {/* Colored indicator */}
                      <div className={cn('w-10 h-10 rounded-full flex-shrink-0', item.color)} />
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#154212] font-medium mb-0.5">{formatTime(item.time)}</p>
                        <p className="text-sm text-[#444444]">{item.title}</p>
                      </div>
                      
                      {/* Three-dot menu */}
                      {item.hasDetail && (
                        <div className="relative">
                          <button 
                            onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                            className="p-1 rounded-full hover:bg-[#f5f5f5]"
                          >
                            <MoreVertical className="w-5 h-5 text-[#999999]" />
                          </button>
                          
                          {/* Dropdown menu */}
                          {openMenuId === item.id && (
                            <div className="absolute right-0 top-8 bg-white border border-[#e5e5e5] rounded-lg shadow-lg z-10 py-1 min-w-[160px]">
                              <Link
                                href={`/history/${item.id}`}
                                className="block px-4 py-2 text-sm text-[#444444] hover:bg-[#f5f5f5]"
                                onClick={() => setOpenMenuId(null)}
                              >
                                ดูรายละเอียด
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
