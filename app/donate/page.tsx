'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/page-header'
import { Heart, CheckCircle2, ChevronLeft, Minus, Plus, Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePoints } from '@/lib/points-context'

interface DonationItem {
  id: number
  name: string
  description: string
  image: string
  /** Running total donated to this campaign so far (in baht). */
  currentAmount: number
}

// Shared "รายละเอียดเพิ่มเติม" content for the donation detail page (temple restoration).
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

// Date shown next to the cumulative donation total on the detail page.
const DONATION_AS_OF = 'ณ วันที่ 5 มิถุนายน 2567 ถึงปัจจุบัน'

// Standard note on how donated points/funds are used (same for every campaign).
const DONATION_NOTE =
  'ยอดเงินบริจาคที่ได้รับจากทุกการร่วมทำบุญจะถูกนำไปรวมเป็นยอดสะสม และทางเว็บไซต์จะดำเนินการโอนเงินไปยังวัดเพื่อการบูรณะเป็นรอบ ๆ เมื่อยอดสะสมครบ 100 บาท (หรือมากกว่า) เพื่อให้การจัดการและการส่งมอบเงินเป็นไปอย่างเหมาะสม โปร่งใส และตรวจสอบได้'

// Mock donation data
const DONATIONS: DonationItem[] = [
  {
    id: 1,
    name: 'ทำบุญค่าบูรณะวัดจากแดง',
    description: 'ร่วมเป็นส่วนหนึ่งในการสืบสานพระพุทธศาสนา และอนุรักษ์ศาสนสถานอันทรงคุณค่าของชุมชน กับการทำบุญเพื่อบูรณะวัดจากแดง',
    image: '/images/temple/วัด2.jpg',
    currentAmount: 2560,
  },
  {
    id: 2,
    name: 'ทำบุญค่าน้ำค่าไฟวัดบางกะเจ้ากลาง',
    description: 'ร่วมสมทบทุนค่าน้ำค่าไฟ เพื่อดูแลศาสนสถานให้พร้อมสำหรับการประกอบศาสนกิจของชุมชน',
    image: 'https://images.unsplash.com/photo-1464207687429-7505649dae38?w=400&h=400&fit=crop',
    currentAmount: 1820,
  },
  {
    id: 3,
    name: 'ทำบุญค่าบูรณะวัดห้วยสายน้ำใจ',
    description: 'ร่วมบูรณะและซ่อมแซมศาสนสถานที่ทรงคุณค่า เพื่อเป็นศูนย์รวมจิตใจของชาวบ้านสืบไป',
    image: '/images/temple/วัดพระสิงห์.jpg',
    currentAmount: 4230,
  },
  {
    id: 4,
    name: 'ทำบุญค่าบูรณะสำนักสงฆ์เขาแก้ว',
    description: 'ร่วมพัฒนาและดูแลพื้นที่ปฏิบัติธรรม ให้เป็นสถานที่อันสงบงามสำหรับชุมชนและคนรุ่นต่อไป',
    image: '/images/temple/วัดภูเขา.jpg',
    currentAmount: 5680,
  },
]

export default function DonatePage() {
  const router = useRouter()
  const { points: userPoints, loading: pointsLoading, spendPoints } = usePoints()
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  // Detail page state — opened by the "รายละเอียด" button
  const [detailDonation, setDetailDonation] = useState<DonationItem | null>(null)

  // Donation modal state — opened by the "บริจาคเลย" button
  const [selectedDonation, setSelectedDonation] = useState<DonationItem | null>(null)
  const [amount, setAmount] = useState<number>(0)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const donateAmount = amount
  const STEP = 10

  const openDetail = (donation: DonationItem) => {
    setDetailDonation(donation)
  }

  const closeDetail = () => {
    setDetailDonation(null)
  }

  const openDonation = (donation: DonationItem) => {
    setDetailDonation(null)
    setSelectedDonation(donation)
    setAmount(0)
    setError(null)
    setSuccess(false)
  }

  const closeModal = () => {
    setSelectedDonation(null)
  }

  const handleConfirmDonation = async () => {
    setError(null)
    if (!selectedDonation) return
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

  // Persist donate favourites separately from reward favourites — their ids
  // overlap (both start at 1), so they must not share the same storage key.
  useEffect(() => {
    const saved = localStorage.getItem('donateFavorites')
    if (saved) {
      try {
        setFavorites(new Set(JSON.parse(saved)))
      } catch (e) {
        console.error('Failed to load donate favorites:', e)
      }
    }
  }, [])

  const toggleFavorite = (id: number) => {
    const newFavorites = new Set(favorites)
    if (newFavorites.has(id)) {
      newFavorites.delete(id)
    } else {
      newFavorites.add(id)
    }
    setFavorites(newFavorites)
    localStorage.setItem('donateFavorites', JSON.stringify(Array.from(newFavorites)))
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f8ff] to-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-6">
        {/* Header Section — back button, title, favourites filter */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => router.back()}
            aria-label="ย้อนกลับ"
            className="p-1 -ml-1 rounded-full text-[#154212] hover:bg-black/5 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <h1 className="flex-1 text-2xl font-bold text-[#154212]">บริจาคคะแนน</h1>
          <button
            onClick={() => setShowFavoritesOnly(v => !v)}
            aria-label="รายการโปรด"
            aria-pressed={showFavoritesOnly}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors',
              showFavoritesOnly
                ? 'bg-red-500 text-white'
                : 'bg-white text-[#154212] border border-[#e5e5e5] hover:bg-[#f0f8ff]'
            )}
          >
            <Heart
              size={18}
              className={showFavoritesOnly ? 'fill-white text-white' : 'text-red-500'}
            />
            รายการโปรด
          </button>
        </div>

        {/* Donate Banner */}
        <div className="relative w-full aspect-[2/1] rounded-2xl overflow-hidden mb-6 shadow-sm">
          <Image
            src="/images/donateBanner.png"
            alt="ร่วมบริจาค 1 คะแนน = 1 บาท"
            fill
            priority
            className="object-cover"
          />
        </div>

        {/* Donation Cards */}
        {showFavoritesOnly && favorites.size === 0 ? (
          <div className="flex flex-col items-center text-center py-16 text-[#999999]">
            <Heart size={40} className="mb-3 text-[#d0d0d0]" />
            <p className="text-sm">ยังไม่มีรายการโปรด</p>
            <p className="text-xs mt-1">แตะรูปหัวใจบนแคมเปญที่คุณสนใจเพื่อบันทึก</p>
          </div>
        ) : (
        <div className="space-y-4">
          {DONATIONS
            .filter(donation => !showFavoritesOnly || favorites.has(donation.id))
            .map((donation, index) => {
            const isFavorited = favorites.has(donation.id)

            return (
              <motion.div
                key={donation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow"
              >
                {/* Image Container — click the temple to open the detail page */}
                <div
                  className="relative w-full aspect-video bg-[#f5f5f5] cursor-pointer"
                  onClick={() => openDetail(donation)}
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
                  <h3 className="text-lg font-bold text-[#154212] mb-3">
                    {donation.name}
                  </h3>

                  {/* Action Buttons — detail + donate */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => openDetail(donation)}
                      className="flex-1 border-2 border-[#154212] text-[#154212] font-bold py-2.5 rounded-lg transition-colors hover:bg-[#f0f8ff]"
                    >
                      รายละเอียด
                    </button>
                    <button
                      onClick={() => openDonation(donation)}
                      className="flex-1 bg-[#154212] hover:bg-[#0d3308] text-white font-bold py-2.5 rounded-lg transition-colors shadow-md hover:shadow-lg"
                    >
                      บริจาคเลย
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
        )}
      </main>

      {/* Detail Page — opened by "รายละเอียด" */}
      {detailDonation && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
            {/* Header with back button */}
            <div className="sticky top-0 bg-white border-b border-black/10 z-10">
              <div className="flex items-center gap-2 h-[50px] px-4">
                <button
                  onClick={closeDetail}
                  aria-label="ย้อนกลับ"
                  className="p-1 -ml-1 text-[#154212]"
                >
                  <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
                </button>
                <span className="text-lg font-bold text-[#154212]">บริจาคคะแนน</span>
              </div>
            </div>

            <div className="px-4 py-4 space-y-4 flex-1">
              {/* Temple image */}
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#f5f5f5]">
                <Image src={detailDonation.image} alt={detailDonation.name} fill className="object-cover" />
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold text-[#154212]">{detailDonation.name}</h2>

              {/* Details */}
              <div className="space-y-4 text-sm text-[#555555] leading-relaxed">
                <div>
                  <p className="font-semibold text-[#888888] mb-1">รายละเอียดเพิ่มเติม</p>
                  <p>{DONATION_DETAIL.purpose}</p>
                </div>

                <div>
                  <p className="text-base font-bold text-[#154212] mb-1">วัตถุประสงค์การบูรณะ</p>
                  <ul className="list-disc list-inside space-y-1">
                    {DONATION_DETAIL.objectives.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                </div>

                <div>
                  <p className="text-base font-bold text-[#154212] mb-1">ร่วมทำบุญกับเรา</p>
                  <p>{DONATION_DETAIL.closing}</p>
                </div>
              </div>

              {/* Cumulative donation total */}
              <div className="flex items-end justify-between pt-2">
                <div>
                  <span className="inline-block bg-[#e8f3e3] text-[#157b03] text-xs font-semibold px-3 py-1 rounded-full">
                    ยอดบริจาคสะสม
                  </span>
                  <p className="text-[11px] text-[#999999] mt-1">{DONATION_AS_OF}</p>
                </div>
                <span className="text-2xl font-bold text-[#154212]">
                  {detailDonation.currentAmount.toLocaleString()} บาท
                </span>
              </div>
            </div>

            {/* Bottom donate button */}
            <div className="sticky bottom-0 bg-white border-t border-black/10 px-4 py-3">
              <button
                onClick={() => openDonation(detailDonation)}
                className="w-full bg-[#154212] hover:bg-[#0d3308] text-white font-bold py-3 rounded-lg transition-colors shadow-md"
              >
                บริจาคเลย
              </button>
            </div>
          </div>
        </div>
      )}

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
