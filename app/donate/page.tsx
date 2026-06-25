'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/page-header'
import { Heart, CheckCircle2, ChevronDown, Minus, Plus, Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePoints } from '@/lib/points-context'

interface DonationItem {
  id: number
  name: string
  description: string
  image: string
  currentAmount: number
  targetAmount: number
  progress: number
}

// Shared "รายละเอียดเพิ่มเติม" content for the donation popup (temple restoration).
const DONATION_DETAIL = {
  purpose:
    'ร่วมเป็นส่วนหนึ่งในการสืบสานพระพุทธศาสนา และอนุรักษ์ศาสนสถานอันทรงคุณค่าของชุมชน กับการทำบุญเพื่อบูรณะวัด',
  objectives: [
    'ซ่อมแซมและปรับปรุงอาคารและศาสนสถานที่ชำรุด',
    'ดูแลพื้นที่ภายในวัดให้สะอาด สงบ และปลอดภัย',
    'สนับสนุนการพัฒนาพื้นที่สำหรับกิจกรรมทางศาสนาและชุมชน',
    'สืบสานคุณค่าทางวัฒนธรรมและพระพุทธศาสนาให้ยั่งยืน',
  ],
  closing:
    'ทุกการบริจาคคือแรงศรัทธาที่ช่วยต่ออายุให้วัดคงเป็นสถานที่แห่งความสงบ และเป็นศูนย์รวมจิตใจของผู้คนในชุมชนสืบไป',
}

// Standard note on how donated points/funds are used (same for every campaign).
const DONATION_NOTE =
  'ยอดเงินบริจาคที่ได้รับจากทุกการร่วมทำบุญจะถูกนำไปรวมเป็นยอดสะสม และทางเว็บไซต์จะดำเนินการโอนเงินไปยังวัดเพื่อการบูรณะเป็นรอบ ๆ เมื่อยอดสะสมครบ 100 บาท (หรือมากกว่า) เพื่อให้การจัดการและการส่งมอบเงินเป็นไปอย่างเหมาะสม โปร่งใส และตรวจสอบได้'

// Mock donation data
const DONATIONS: DonationItem[] = [
  {
    id: 1,
    name: 'สำนักสงฆ์ห้วยทำเนียว',
    description: 'เก็บเนียวโบราณที่สวยงามสำนักสงฆ์ห้วยทำเนียว',
    image: '/images/temple/วัด2.jpg',
    currentAmount: 15670,
    targetAmount: 50000,
    progress: 31
  },
  {
    id: 2,
    name: 'วัดศรีสายน้ำ',
    description: 'สร้างห้องสมุดวิทยาศาสตร์สำหรับชาวบ้าน',
    image: 'https://images.unsplash.com/photo-1464207687429-7505649dae38?w=400&h=400&fit=crop',
    currentAmount: 28500,
    targetAmount: 75000,
    progress: 38
  },
  {
    id: 3,
    name: 'วัดห้วยสายน้ำใจบิน',
    description: 'ปรับปรุงพื้นพวงพื้นสัตว์ในประเทศไทย',
    image: '/images/temple/วัดพระสิงห์.jpg',
    currentAmount: 42300,
    targetAmount: 100000,
    progress: 42
  },
  {
    id: 4,
    name: 'สำนักสงฆ์เขาแก้ว',
    description: 'ฟื้นฟูป่าทำไม้สำหรับชุมชนท้องถิ่น',
    image: '/images/temple/วัดภูเขา.jpg',
    currentAmount: 56800,
    targetAmount: 90000,
    progress: 63
  },
]

export default function DonatePage() {
  const { points: userPoints, loading: pointsLoading, spendPoints } = usePoints()
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [selectedDonation, setSelectedDonation] = useState<DonationItem | null>(null)

  // Donation modal state
  const [amount, setAmount] = useState<number>(0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const donateAmount = amount
  const STEP = 10

  const openDonation = (donation: DonationItem) => {
    setSelectedDonation(donation)
    setAmount(0)
    setDetailsOpen(false)
    setError(null)
    setSuccess(false)
  }

  const closeModal = () => {
    setSelectedDonation(null)
  }

  const handleConfirmDonation = async () => {
    setError(null)
    if (!donateAmount || donateAmount <= 0) {
      setError('กรุณาเลือกจำนวนคะแนนที่ต้องการบริจาค')
      return
    }
    if (donateAmount > userPoints) {
      setError('คะแนนของคุณไม่เพียงพอ')
      return
    }
    setProcessing(true)
    const result = await spendPoints(donateAmount, {
      category: 'donate',
      items: [{ name: selectedDonation.name, quantity: 1, points: donateAmount }],
    })
    setProcessing(false)
    if (result.success) {
      setSuccess(true)
    } else {
      setError(result.message || 'ไม่สามารถบริจาคได้ กรุณาลองใหม่')
    }
  }

  const toggleFavorite = (id: number) => {
    const newFavorites = new Set(favorites)
    if (newFavorites.has(id)) {
      newFavorites.delete(id)
    } else {
      newFavorites.add(id)
    }
    setFavorites(newFavorites)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f8ff] to-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-6">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#154212] mb-2">บริจาคคะแนน</h1>
          <p className="text-sm text-[#666666]">
            ร่วมบริจาค 1 คะแนน = 1 บาท เพื่อสนับสนุนกิจกรรมการอนุรักษ์สิ่งแวดล้อม
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-gradient-to-r from-[#ffd700] to-[#ffed4e] rounded-2xl p-4 mb-6 border-2 border-[#ffc700]">
          <p className="text-sm font-semibold text-[#8b6914] text-center">
            ✨ ร่วมบริจาค 1 คะแนน = 1 บาท
          </p>
        </div>

        {/* Donation Cards */}
        <div className="space-y-4">
          {DONATIONS.map((donation, index) => {
            const isFavorited = favorites.has(donation.id)

            return (
              <motion.div
                key={donation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow"
              >
                {/* Image Container — click the temple to open the donation popup */}
                <div
                  className="relative w-full aspect-video bg-[#f5f5f5] cursor-pointer"
                  onClick={() => openDonation(donation)}
                >
                  <Image
                    src={donation.image}
                    alt={donation.name}
                    fill
                    className="object-cover"
                  />

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(donation.id) }}
                    className="absolute top-3 right-3 z-10 transition-transform hover:scale-110"
                  >
                    <Heart
                      size={24}
                      className={cn(
                        'transition-all',
                        isFavorited
                          ? 'fill-red-500 text-red-500'
                          : 'text-white drop-shadow-lg'
                      )}
                    />
                  </button>

                  {/* Category Badge */}
                  <div className="absolute top-3 left-3 bg-[#154212]/90 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    วัด
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  {/* Title */}
                  <h3 className="text-lg font-bold text-[#154212] mb-1">
                    {donation.name}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-[#666666] mb-3 line-clamp-2">
                    {donation.description}
                  </p>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-[#154212]">
                        ความคืบหน้า
                      </span>
                      <span className="text-xs font-bold text-[#154212]">
                        {donation.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-[#e5e5e5] rounded-full h-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${donation.progress}%` }}
                        transition={{ delay: 0.2 + index * 0.1, duration: 0.6 }}
                        className="bg-gradient-to-r from-[#154212] to-[#1a7a15] h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="flex justify-between items-baseline mb-4 bg-[#f0f8ff] rounded-lg p-2">
                    <span className="text-sm text-[#666666]">
                      เก็บรวม:
                    </span>
                    <span className="text-lg font-bold text-[#154212]">
                      {donation.currentAmount.toLocaleString()} / {donation.targetAmount.toLocaleString()} บาท
                    </span>
                  </div>

                  {/* Donate Button */}
                  <button
                    onClick={() => openDonation(donation)}
                    className="w-full bg-[#154212] hover:bg-[#0d3308] text-white font-bold py-2.5 rounded-lg transition-colors shadow-md hover:shadow-lg"
                  >
                    บริจาคเลย
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </main>

      {/* Donation Modal */}
      {selectedDonation && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={closeModal}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="w-full max-w-md mx-auto bg-white rounded-t-3xl max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {success ? (
              /* Success state after points were spent */
              <div className="flex flex-col items-center text-center p-6 py-8">
                <CheckCircle2 size={64} className="text-[#157b03] mb-3" />
                <h2 className="text-xl font-bold text-[#154212] mb-1">ขอบคุณสำหรับการบริจาค!</h2>
                <p className="text-sm text-[#666666] mb-1">
                  คุณบริจาค {donateAmount.toLocaleString()} คะแนน ให้กับ {selectedDonation.name}
                </p>
                <p className="text-sm text-[#666666] mb-5">
                  คะแนนคงเหลือ {userPoints.toLocaleString()} คะแนน
                </p>
                <button
                  onClick={closeModal}
                  className="w-full py-3 bg-[#154212] text-white font-bold rounded-lg hover:bg-[#0d3308] transition-colors"
                >
                  เสร็จสิ้น
                </button>
              </div>
            ) : (
              <>
                {/* Sticky header */}
                <div className="sticky top-0 bg-white px-6 pt-5 pb-3 border-b border-[#f0f0f0] z-10">
                  <h2 className="text-lg font-bold text-[#154212]">บริจาคคะแนน</h2>
                </div>

                <div className="px-6 pb-6 pt-4 space-y-4">
                  {/* Temple image */}
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#f5f5f5]">
                    <Image src={selectedDonation.image} alt={selectedDonation.name} fill className="object-cover" />
                  </div>

                  {/* Campaign title */}
                  <h3 className="text-lg font-bold text-[#154212]">{selectedDonation.name}</h3>

                  {/* Expandable details */}
                  <div className="border border-[#e5e5e5] rounded-lg overflow-hidden">
                    <button
                      onClick={() => setDetailsOpen(o => !o)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm text-[#444444]"
                    >
                      <span>รายละเอียดเพิ่มเติม</span>
                      <ChevronDown className={cn('w-5 h-5 text-[#666666] transition-transform', detailsOpen && 'rotate-180')} />
                    </button>
                    {detailsOpen && (
                      <div className="px-4 pb-4 space-y-3 text-sm text-[#666666] border-t border-[#f0f0f0] pt-3">
                        <p>{DONATION_DETAIL.purpose}</p>
                        <div>
                          <p className="font-semibold text-[#154212] mb-1">วัตถุประสงค์การบูรณะ</p>
                          <ul className="list-disc list-inside space-y-1">
                            {DONATION_DETAIL.objectives.map((o, i) => <li key={i}>{o}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-[#154212] mb-1">ร่วมทำบุญกับเรา</p>
                          <p>{DONATION_DETAIL.closing}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Current points */}
                  <div className="text-center">
                    <p className="text-sm text-[#666666] mb-1">คะแนนสะสมของคุณ</p>
                    <div className="flex items-center justify-center gap-1.5">
                      <Leaf className="w-5 h-5 text-[#157b03]" />
                      <span className="text-lg font-bold text-[#154212]">
                        {pointsLoading ? '…' : userPoints.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Amount stepper */}
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => { setAmount(a => Math.max(0, a - STEP)); setError(null) }}
                      className="w-12 h-12 rounded-full bg-[#154212] text-white flex items-center justify-center hover:bg-[#0d3308] transition-colors"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={amount}
                      onChange={(e) => { setAmount(Math.max(0, Number(e.target.value) || 0)); setError(null) }}
                      className="w-28 text-center text-3xl font-bold text-[#154212] border-2 border-[#e5e5e5] rounded-xl py-2 focus:border-[#154212] focus:outline-none"
                    />
                    <button
                      onClick={() => { setAmount(a => a + STEP); setError(null) }}
                      className="w-12 h-12 rounded-full bg-[#154212] text-white flex items-center justify-center hover:bg-[#0d3308] transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-center text-sm text-[#666666]">1 คะแนน = 1 บาท</p>

                  {/* Usage note */}
                  <div className="bg-[#f9f9f9] rounded-lg p-3">
                    <p className="text-xs font-semibold text-[#154212] mb-1">*หมายเหตุการนำเงินบริจาคไปใช้</p>
                    <p className="text-xs text-[#999999] leading-relaxed">{DONATION_NOTE}</p>
                  </div>

                  {/* Error notice */}
                  {error && (
                    <div className="text-xs text-[#cc0000] bg-[#fff0f0] border border-[#ffb3b3] rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={closeModal}
                      disabled={processing}
                      className="flex-1 py-3 border-2 border-[#e5e5e5] text-[#154212] font-bold rounded-lg hover:bg-[#f5f5f5] transition-colors disabled:opacity-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleConfirmDonation}
                      disabled={processing || pointsLoading || !donateAmount}
                      className={cn(
                        'flex-1 py-3 font-bold rounded-lg transition-colors',
                        processing || pointsLoading || !donateAmount
                          ? 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
                          : 'bg-[#154212] text-white hover:bg-[#0d3308]'
                      )}
                    >
                      {processing ? 'กำลังบริจาค…' : 'ยืนยัน'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  )
}
