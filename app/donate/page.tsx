'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/page-header'
import { Heart, CheckCircle2 } from 'lucide-react'
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

// Mock donation data
const DONATIONS: DonationItem[] = [
  {
    id: 1,
    name: 'สำนักสงฆ์ห้วยทำเนียว',
    description: 'เก็บเนียวโบราณที่สวยงามสำนักสงฆ์ห้วยทำเนียว',
    image: 'https://images.unsplash.com/photo-1548013146-72839103ba69?w=400&h=400&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1494783367193-149034c05e41?w=400&h=400&fit=crop',
    currentAmount: 42300,
    targetAmount: 100000,
    progress: 42
  },
  {
    id: 4,
    name: 'สำนักสงฆ์เขาแก้ว',
    description: 'ฟื้นฟูป่าทำไม้สำหรับชุมชนท้องถิ่น',
    image: 'https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=400&h=400&fit=crop',
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
  const [customAmount, setCustomAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const donateAmount = customAmount ? Number(customAmount) : amount

  const openDonation = (donation: DonationItem) => {
    setSelectedDonation(donation)
    setAmount(0)
    setCustomAmount('')
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
    const result = await spendPoints(donateAmount)
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
                {/* Image Container */}
                <div className="relative w-full aspect-video bg-[#f5f5f5]">
                  <Image
                    src={donation.image}
                    alt={donation.name}
                    fill
                    className="object-cover"
                  />

                  {/* Favorite Button */}
                  <button
                    onClick={() => toggleFavorite(donation.id)}
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
            className="w-full bg-white rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {success ? (
              /* Success state after points were spent */
              <div className="flex flex-col items-center text-center py-4">
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
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-[#154212] mb-2">
                    {selectedDonation.name}
                  </h2>
                  <p className="text-sm text-[#666666]">
                    กรุณาเลือกจำนวนคะแนนที่ต้องการบริจาค
                  </p>
                  <p className="text-sm font-semibold text-[#154212] mt-1">
                    คะแนนของคุณ: {pointsLoading ? '…' : userPoints.toLocaleString()} คะแนน
                  </p>
                </div>

                {/* Amount Input */}
                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[10, 50, 100, 500].map((preset) => {
                      const isSelected = !customAmount && amount === preset
                      return (
                        <button
                          key={preset}
                          onClick={() => { setAmount(preset); setCustomAmount(''); setError(null) }}
                          className={cn(
                            'w-full py-3 border-2 font-bold rounded-lg transition-colors',
                            isSelected
                              ? 'bg-[#154212] text-white border-[#154212]'
                              : 'border-[#154212] text-[#154212] hover:bg-[#154212] hover:text-white'
                          )}
                        >
                          {preset} คะแนน
                        </button>
                      )
                    })}
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setAmount(0); setError(null) }}
                    placeholder="ป้อนจำนวนแบบกำหนดเอง"
                    className="w-full px-4 py-3 border-2 border-[#e5e5e5] rounded-lg text-[#154212] placeholder-[#999999] focus:border-[#154212] focus:outline-none"
                  />
                </div>

                {/* Error notice */}
                {error && (
                  <div className="text-xs text-[#cc0000] bg-[#fff0f0] border border-[#ffb3b3] rounded-lg px-3 py-2 mb-3">
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
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  )
}
