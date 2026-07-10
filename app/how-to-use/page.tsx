'use client'

import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import liff from '@line/liff'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Recycle, Scale, Camera, QrCode, Play, HelpCircle } from 'lucide-react'
import { InfographicCarousel, type InfographicSlide } from '@/components/infographic-carousel'

// Infographic catalog, shown in the order requested: 9→3→7→2→1→4→5→6→10.
// (4 = record-waste-guide, 5 = redeem-rewards-guide, 6 = user-profile-qr-guide.)
const INFOGRAPHICS: InfographicSlide[] = [
  { src: '/guide-9-เชิญชวน.png', alt: 'เชิญชวนร่วมโครงการ' },
  { src: '/guide-3-การเดินทางของน้องรักษ์.png', alt: 'การเดินทางของน้องรักษ์' },
  { src: '/guide-7-checklist.png', alt: 'เช็กลิสต์การใช้งาน' },
  { src: '/guide-2-ตารางรับขยะ.png', alt: 'ตารางรับขยะ' },
  { src: '/guide-1-คู่มือแยกขยะ.png', alt: 'คู่มือแยกขยะ' },
  { src: '/record-waste-guide.png', alt: 'วิธีบันทึกขยะ' },
  { src: '/guide-12.png', alt: 'ดูคะแนน' },
  { src: '/redeem-rewards-guide.png', alt: 'วิธีแลกของรางวัล' },
  { src: '/guide-11.png', alt: 'วิธีบริจาคคะแนน' },
  { src: '/user-profile-qr-guide.png', alt: 'โปรไฟล์และ QR Code' },
  { src: '/guide-10-คำนวณ.png', alt: 'วิธีคำนวณคะแนน' },
]

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

// FAQ — common questions answered so users can self-serve before asking the bot.
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
    a: 'รับขยะรีไซเคิล เช่น พลาสติก กระดาษ แก้ว และอลูมิเนียม ตามขั้นตอนด้านบน',
  },
  {
    q: 'เปลี่ยนข้อมูลส่วนตัวยังไง?',
    a: 'ดูข้อมูลของคุณได้ที่หน้าโปรไฟล์ หากต้องการแก้ไข พิมพ์แจ้งแชทบอทหรือติดต่อเจ้าหน้าที่',
  },
]

export default function HowToUsePage() {
  // Close the LIFF window so the user lands back in the LINE chat with the bot.
  const goToChat = () => {
    liff.closeWindow()
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Page Title */}
        <h1 className="text-2xl font-bold text-[#154212] mb-4">วิธีใช้งาน</h1>

        {/* Tutorial video — hidden until a video is available */}
        {false && (
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
        )}

        {/* Infographic catalog — swipeable, looping */}
        <section className="mb-6">
          <h3 className="text-lg font-bold text-[#154212] mb-4">อินโฟกราฟิกวิธีใช้งาน</h3>
          <InfographicCarousel slides={INFOGRAPHICS} />
        </section>

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

        {/* FAQ Section */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-[#154212]" />
            <h3 className="text-lg font-bold text-[#154212]">คำถามที่พบบ่อย</h3>
          </div>

          <Accordion
            type="single"
            collapsible
            className="rounded-2xl border border-[#e5e5e5] bg-white shadow-sm px-5"
          >
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
            className="mt-3 block w-full rounded-2xl border border-[#cdeccb] bg-[#f3faf1] px-5 py-4 text-center text-sm font-semibold text-[#06994a] hover:bg-[#e8f5e6] transition-colors"
          >
            ไม่เจอคำตอบ? พิมพ์ถามแชทบอทได้เลย →
          </button>
        </section>
      </main>

      {/* <BottomNav /> */}
    </div>
  )
}
