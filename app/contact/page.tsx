'use client'

import Image from 'next/image'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { Phone, MessageCircle, Mail, MapPin, Clock, ChevronRight } from 'lucide-react'

const contactMethods = [
  {
    icon: Phone,
    label: 'โทรศัพท์',
    value: '02-123-4567',
    action: 'tel:021234567',
    color: '#EF5350'
  },
  {
    icon: Phone,
    label: 'มือถือ',
    value: '081-234-5678',
    action: 'tel:0812345678',
    color: '#66BB6A'
  },
  {
    icon: MessageCircle,
    label: 'LINE Official',
    value: '@digitalwaste',
    action: 'https://line.me/R/ti/p/@digitalwaste',
    color: '#00B900'
  },
  {
    icon: Mail,
    label: 'อีเมล',
    value: 'contact@digitalwaste.co.th',
    action: 'mailto:contact@digitalwaste.co.th',
    color: '#42A5F5'
  }
]

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-[#b6ebad] to-[#8fdf7f] rounded-2xl p-6 mb-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="w-20 h-20 mx-auto mb-4 relative">
              <Image
                src="/images/icon/logo.png"
                alt="Logo"
                fill
                className="object-contain rounded-lg"
              />
            </div>
            <h1 className="text-xl font-bold text-[#154212] text-center mb-1">
              Digital Wasted Account
            </h1>
            <p className="text-sm text-[#154212]/80 text-center">
              ติดต่อเรา
            </p>
          </div>
        </div>

        {/* Contact Methods */}
        <div className="space-y-3 mb-6">
          {contactMethods.map((method, index) => (
            <a
              key={index}
              href={method.action}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-[#e5e5e5] hover:border-[#154212] hover:shadow-md transition-all"
            >
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: method.color + '20' }}
              >
                <method.icon className="w-6 h-6" style={{ color: method.color }} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#666666]">{method.label}</p>
                <p className="text-base font-medium text-[#444444]">{method.value}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-[#999999]" />
            </a>
          ))}
        </div>

        {/* Office Info */}
        <div className="bg-[#f5f5f5] rounded-xl p-4 space-y-4">
          <h2 className="text-base font-semibold text-[#154212]">ที่อยู่สำนักงาน</h2>
          
          <div className="flex gap-3">
            <MapPin className="w-5 h-5 text-[#154212] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#666666] leading-relaxed">
              123 อาคาร ABC ชั้น 10<br />
              ถนนสุขุมวิท แขวงคลองเตย<br />
              เขตคลองเตย กรุงเทพฯ 10110
            </p>
          </div>
          
          <div className="flex gap-3">
            <Clock className="w-5 h-5 text-[#154212] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[#666666]">
              <p className="font-medium text-[#444444] mb-1">เวลาทำการ</p>
              <p>จันทร์ - ศุกร์: 08:30 - 17:30 น.</p>
              <p>เสาร์: 09:00 - 12:00 น.</p>
              <p>อาทิตย์: ปิดทำการ</p>
            </div>
          </div>
        </div>

        {/* Chat Button */}
        <div className="mt-6">
          <button className="w-full py-4 rounded-xl bg-[#154212] text-white font-semibold hover:bg-[#0d3308] transition-colors flex items-center justify-center gap-2">
            <MessageCircle className="w-5 h-5" />
            แชทกับเจ้าหน้าที่
          </button>
        </div>
      </main>

      {/* <BottomNav /> */}
    </div>
    // test2
  )
}
