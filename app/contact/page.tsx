'use client'

import Image from 'next/image'
import { PageHeader } from '@/components/page-header'
import liff from '@line/liff'
import { Phone, Mail, MapPin, Clock, ChevronRight } from 'lucide-react'

// Placeholder contact channels — values are not real yet (shown as "coming soon").
const PLACEHOLDER_CHANNELS = [
  { icon: Phone, label: 'โทรศัพท์', value: 'ยังไม่มีข้อมูล' },
  { icon: Mail, label: 'อีเมล', value: 'ยังไม่มีข้อมูล' },
  { icon: MapPin, label: 'ที่อยู่สำนักงาน', value: 'ยังไม่มีข้อมูล' },
  { icon: Clock, label: 'เวลาทำการ', value: 'ยังไม่มีข้อมูล' },
]

export default function ContactPage() {
  // Close the LIFF window so the user lands back in the LINE chat,
  // where they type their question to the bot.
  const goToChat = () => {
    liff.closeWindow()
  }

  return (
    <div className="min-h-screen bg-[#f5f7f5] pb-12">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4 space-y-6">
        {/* Hero — tap to jump back into the LINE chat with the bot */}
        <button
          onClick={goToChat}
          className="w-full text-left bg-[#154212] rounded-2xl px-4 py-3 flex items-center gap-3 relative overflow-hidden hover:bg-[#1a5417] transition-colors"
        >
          <div className="relative w-14 h-14 flex-shrink-0">
            <Image src="/mascot.png" alt="mascot" fill className="object-contain drop-shadow-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-white leading-tight">มีอะไรให้เราช่วยไหม?</h1>
            <p className="text-xs text-white/80">แตะที่นี่เพื่อพิมพ์ถามแชทบอทได้ทันที</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/70 flex-shrink-0" />
        </button>

        {/* Other channels — clearly marked as not available yet.
            Top is faded (barely visible) so it reads as a peek → scroll down. */}
        <section className="space-y-3 [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.12),#000_60%)] [-webkit-mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.12),#000_60%)]">
          <h2 className="text-base font-bold text-[#154212] px-1">ช่องทางติดต่ออื่น</h2>

          <div className="bg-white rounded-2xl border border-[#e5e5e5] shadow-sm divide-y divide-[#eee]">
            {PLACEHOLDER_CHANNELS.map((c, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4 opacity-60">
                <div className="w-11 h-11 rounded-full bg-[#f0f0f0] flex items-center justify-center flex-shrink-0">
                  <c.icon className="w-5 h-5 text-[#999999]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#444444]">{c.label}</p>
                  <p className="text-sm text-[#999999] italic">{c.value}</p>
                </div>
                <span className="text-xs font-semibold text-[#b8860b] bg-[#fff3cd] rounded-full px-2.5 py-1 flex-shrink-0">
                  เร็ว ๆ นี้
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
