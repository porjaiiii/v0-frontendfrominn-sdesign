'use client'

import Image from 'next/image'
import { PageHeader } from '@/components/page-header'
import { useLiffContext } from '@/lib/liff-context'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Phone, Mail, MapPin, Clock, HelpCircle } from 'lucide-react'

// LINE Official Account — users can type their question to the chatbot here.
const LINE_OA_URL = 'https://line.me/R/ti/p/@digitalwaste'

// FAQ — common questions answered so users can self-serve before contacting.
const FAQS = [
  {
    q: 'ใช้แต้มแลกของรางวัลยังไง?',
    a: 'ไปที่หน้า "แลกของรางวัล" เลือกของที่ต้องการ แล้วกดแลก ระบบจะสร้างคูปอง QR Code ให้นำไปแสดงกับเจ้าหน้าที่',
  },
  {
    q: 'ทำไมแต้มยังไม่เข้า?',
    a: 'แต้มจะเข้าหลังจากเจ้าหน้าที่ตรวจสอบและรับขยะเรียบร้อยแล้ว หากรอเกิน 1-2 วันแล้วยังไม่เข้า พิมพ์ถามแชทบอทได้เลย',
  },
  {
    q: 'คูปองมีวันหมดอายุไหม?',
    a: 'คูปองที่แลกแล้วควรนำไปใช้โดยเร็ว สถานะและรายละเอียดจะแสดงอยู่ในหน้า "คูปองของฉัน"',
  },
  {
    q: 'ขยะแบบไหนที่รับบ้าง?',
    a: 'รับขยะรีไซเคิล เช่น พลาสติก กระดาษ แก้ว และอลูมิเนียม ดูขั้นตอนได้ที่หน้า "วิธีใช้งาน"',
  },
  {
    q: 'เปลี่ยนข้อมูลส่วนตัวยังไง?',
    a: 'ดูข้อมูลของคุณได้ที่หน้าโปรไฟล์ หากต้องการแก้ไข พิมพ์แจ้งแชทบอทหรือติดต่อเจ้าหน้าที่',
  },
]

// Placeholder contact channels — values are not real yet (shown as "coming soon").
const PLACEHOLDER_CHANNELS = [
  { icon: Phone, label: 'โทรศัพท์', value: 'ยังไม่มีข้อมูล' },
  { icon: Mail, label: 'อีเมล', value: 'ยังไม่มีข้อมูล' },
  { icon: MapPin, label: 'ที่อยู่สำนักงาน', value: 'ยังไม่มีข้อมูล' },
  { icon: Clock, label: 'เวลาทำการ', value: 'ยังไม่มีข้อมูล' },
]

export default function ContactPage() {
  const { closeWindow, isInClient } = useLiffContext()

  // Same behavior as finishing a waste record: inside LINE, close the LIFF
  // window so the user lands back in the chat (where they type to the bot).
  // Outside LINE, open the Official Account link instead.
  const goToChat = () => {
    if (isInClient) {
      closeWindow()
    } else {
      window.open(LINE_OA_URL, '_blank')
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7f5] pb-12">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4 space-y-6">
        {/* Hero */}
        <div className="bg-[#154212] rounded-2xl px-4 py-3 flex items-center gap-3 relative overflow-hidden">
          <div className="relative w-14 h-14 flex-shrink-0">
            <Image src="/mascot.png" alt="mascot" fill className="object-contain drop-shadow-lg" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white leading-tight">มีอะไรให้เราช่วยไหม?</h1>
            <p className="text-xs text-white/80">พิมพ์คำถามของคุณ แล้วแชทบอทตอบให้ทันที</p>
          </div>
        </div>

        {/* FAQ */}
        <section className="bg-white rounded-2xl border border-[#e5e5e5] shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-1">
            <HelpCircle className="w-5 h-5 text-[#154212]" />
            <h2 className="text-lg font-bold text-[#154212]">คำถามที่พบบ่อย</h2>
          </div>

          <Accordion type="single" collapsible className="px-5 pb-2">
            {FAQS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-[#eee]">
                <AccordionTrigger className="text-base font-semibold text-[#154212] hover:no-underline py-4">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-[#555555] leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Nudge toward the chatbot for anything not covered */}
          <button
            onClick={goToChat}
            className="block w-full border-t border-[#eee] px-5 py-4 text-center text-sm font-semibold text-[#06994a] hover:bg-[#f3faf4] transition-colors"
          >
            ไม่เจอคำตอบ? พิมพ์ถามแชทบอทได้เลย →
          </button>
        </section>

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
