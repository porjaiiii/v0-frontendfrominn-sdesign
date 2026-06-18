'use client'

import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { Recycle, Scale, Camera, QrCode, Play } from 'lucide-react'

// Steps data — matches the Figma design (circular pastel icons + wording)
const STEPS = [
  {
    id: 1,
    title: 'เลือกประเภทขยะ',
    description: 'เลือกประเภทขยะที่ต้องการรีไซเคิล เช่น พลาสติก กระดาษ แก้ว อลูมิเนียม',
    icon: Recycle,
    bgColor: 'bg-[#d4e7f7]',
    iconColor: 'text-[#3d8bcd]',
  },
  {
    id: 2,
    title: 'ชั่งน้ำหนัก',
    description: 'ชั่งน้ำหนักขยะที่ต้องการส่ง และระบุน้ำหนักในแอป',
    icon: Scale,
    bgColor: 'bg-[#cdeccb]',
    iconColor: 'text-[#3a9d2f]',
  },
  {
    id: 3,
    title: 'ถ่ายรูปหลักฐาน',
    description: 'ถ่ายรูปขยะพร้อมตราชั่งเพื่อเป็นหลักฐาน',
    icon: Camera,
    bgColor: 'bg-[#f8ebc2]',
    iconColor: 'text-[#cfa72e]',
  },
  {
    id: 4,
    title: 'แสดง QR Code',
    description: 'แสดง QR Code ประจำตัว เมื่อเจ้าหน้าที่เข้ารับขยะ',
    icon: QrCode,
    bgColor: 'bg-[#e6d8f2]',
    iconColor: 'text-[#8b5cc0]',
  },
]

export default function HowToUsePage() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Page Title */}
        <h1 className="text-2xl font-bold text-[#154212] mb-4">วิธีใช้งาน</h1>

        {/* Tutorial video — skeleton placeholder (no video yet) */}
        <div className="border-2 border-[#cdeccb] rounded-2xl p-3 bg-[#f3faf1] mb-6">
          <div className="relative aspect-video rounded-xl overflow-hidden bg-[#e5e7eb] shimmer">
            {/* Centered play button */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <div className="w-14 h-14 rounded-full bg-white/80 shadow-md flex items-center justify-center">
                <Play className="w-6 h-6 text-[#154212] fill-[#154212] ml-0.5" />
              </div>
              <span className="text-xs font-medium text-[#5a7a5a]">วิดีโอเร็ว ๆ นี้</span>
            </div>
          </div>
        </div>

        {/* Steps Section */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-[#154212] mb-4">ขั้นตอนการใช้งาน</h3>

          <div className="space-y-4">
            {STEPS.map((step) => {
              const IconComponent = step.icon
              return (
                <div key={step.id} className="flex items-start gap-4">
                  {/* Circular icon */}
                  <div className={`w-12 h-12 ${step.bgColor} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <IconComponent className={`w-6 h-6 ${step.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-0.5">
                    <h4 className="text-base font-bold text-[#154212] mb-0.5">
                      {step.id}. {step.title}
                    </h4>
                    <p className="text-sm text-[#666666] leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* <BottomNav /> */}
    </div>
  )
}
