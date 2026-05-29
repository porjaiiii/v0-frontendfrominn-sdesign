'use client'

import Image from 'next/image'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { Recycle, Scale, Camera, QrCode } from 'lucide-react'

// Steps data
const STEPS = [
  {
    id: 1,
    title: 'เลือกประเภทขยะ',
    description: 'เลือกประเภทขยะที่ต้องการรีไซเคิล เช่น พลาสติก กระดาษ แก้ว อลูมิเนียม หรือน้ำมัน',
    icon: Recycle,
    bgColor: 'bg-[#b6ebad]',
    iconColor: 'text-[#154212]'
  },
  {
    id: 2,
    title: 'ชั่งน้ำหนัก',
    description: 'ชั่งน้ำหนักขยะที่ต้องการส่ง และระบุน้ำหนักในแอป',
    icon: Scale,
    bgColor: 'bg-[#f9e7b0]',
    iconColor: 'text-[#b8860b]'
  },
  {
    id: 3,
    title: 'ถ่ายรูปหลักฐาน',
    description: 'ถ่ายรูปขยะพร้อมตาชั่งเพื่อเป็นหลักฐาน',
    icon: Camera,
    bgColor: 'bg-gradient-to-br from-[#91c1e7] to-[#b6ebad]',
    iconColor: 'text-[#154212]'
  },
  {
    id: 4,
    title: 'รับ QR Code',
    description: 'รับ QR Code เพื่อใช้ในการยืนยันการส่งขยะ',
    icon: QrCode,
    bgColor: 'bg-[#e5e5e5]',
    iconColor: 'text-[#444444]'
  }
]

export default function HowToUsePage() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Page Title */}
        <h1 className="text-lg font-semibold text-[#154212] mb-4">หน้าวิธีใช้งาน</h1>

        {/* Welcome Card */}
        <div className="bg-gradient-to-br from-[#b6ebad] to-[#8fdf7f] rounded-2xl p-6 mb-6 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-4 right-4 w-20 h-20 bg-white/20 rounded-full" />
          <div className="absolute bottom-4 left-4 w-12 h-12 bg-white/20 rounded-full" />
          
          {/* Content */}
          <div className="text-center relative z-0">
            {/* Logo/Icon */}
            <div className="w-24 h-24 mx-auto mb-4 bg-white/30 rounded-2xl flex items-center justify-center">
              <div className="w-12 h-12 bg-white rounded-lg" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-[#154212] mb-1">
              ยินดีต้อนรับสู่ C-vitt
            </h2>

            {/* Description */}
            <p className="text-sm text-[#154212]/80">
              แอปพลิเคชันรีไซเคิลขยะ ช่วยลดคาร์บอน รักษ์โลก
            </p>
          </div>
        </div>

        {/* Steps Section */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-[#154212] mb-4">ขั้นตอนการใช้งาน</h3>
          
          <div className="space-y-3">
            {STEPS.map((step) => {
              const IconComponent = step.icon
              return (
                <div key={step.id} className="flex items-start gap-4 p-3 bg-white rounded-xl border border-[#e5e5e5]">
                  {/* Icon */}
                  <div className={`w-12 h-12 ${step.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <IconComponent className={`w-6 h-6 ${step.iconColor}`} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-[#154212] mb-0.5">
                      {step.id}. {step.title}
                    </h4>
                    <p className="text-xs text-[#666666] leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
