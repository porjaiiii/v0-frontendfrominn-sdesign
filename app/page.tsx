'use client'

import { useState, useContext } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { WeightInput, ImageEvidence } from '@/components/weight-input'
import { CarbonResultModal } from '@/components/carbon-result-modal'
import { WASTE_TYPES, WASTE_SUBTYPES } from '@/lib/waste-data'
import { type WasteType, type WasteSubType } from '@/lib/app-context'
import { cn } from '@/lib/utils'
import { LiffContext } from '@/lib/liff-context'

// Carbon factors per kg for each waste type
const CARBON_FACTORS: Record<WasteType, number> = {
  plastic: 2.5,
  paper: 1.8,
  glass: 0.8,
  aluminum: 4.0,
  oil: 3.0,
}

// Waste type images
const WASTE_IMAGES: Record<WasteType, string> = {
  plastic: '/images/waste/plastic.jpg',
  paper: '/images/waste/paper.jpg',
  glass: '/images/waste/glass.jpg',
  aluminum: '/images/waste/aluminum.jpg',
  oil: '/images/waste/plastic.jpg',
}

export default function HomePage() {
  const router = useRouter()
  const liffContext = useContext(LiffContext)
  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState<WasteType | null>(null)
  const [selectedSubType, setSelectedSubType] = useState<WasteSubType | null>(null)
  const [weight, setWeight] = useState(0)
  const [imageEvidence, setImageEvidence] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [showQRResult, setShowQRResult] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const calculatedCarbon = selectedType 
    ? weight * CARBON_FACTORS[selectedType]
    : 0

  const handleTypeSelect = (type: WasteType) => {
    setSelectedType(type)
    setSelectedSubType(null)
    setStep(2)
  }

  const handleSubTypeSelect = (subType: WasteSubType) => {
    setSelectedSubType(subType)
    setStep(3)
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
      if (step === 2) {
        setSelectedType(null)
      } else if (step === 3) {
        setSelectedSubType(null)
      }
    }
  }

  const handleNext = () => {
    if (step === 3 && weight > 0) {
      setShowResult(true)
    }
  }

  const handleShowQR = async () => {
    setShowResult(false)
    setIsSubmitting(true)
    
    try {
      // ดึง user_id จาก LIFF context
      const userId = liffContext?.userProfile?.userId || 'unknown-user'
      
      // เรียก API บันทึกขยะ
      const response = await fetch('/api/waste/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          waste_type: selectedType,
          waste_subtype: selectedSubType?.id,
          weight_kg: weight,
          image_url: imageEvidence || null,
          notes: '',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit waste record')
      }

      console.log('[v0] Waste submitted successfully')
      setShowQRResult(true)
    } catch (error) {
      console.error('[v0] Error submitting waste:', error)
      alert('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = () => {
    setShowQRResult(false)
    // Reset form
    setStep(1)
    setSelectedType(null)
    setSelectedSubType(null)
    setWeight(0)
    setImageEvidence(null)
    router.push('/ranking')
  }

  const getStepTitle = () => {
    switch (step) {
      case 1: return 'เลือกประเภทขยะ'
      case 2: return `ประเภท${WASTE_TYPES.find(t => t.id === selectedType)?.name || ''}`
      case 3: return 'ระบุน้ำหนักและหลักฐาน'
      default: return ''
    }
  }

  // Get subtype images based on type
  const getSubTypeImage = (type: WasteType, subTypeId: string) => {
    const imageMap: Record<string, string> = {
      'pet': '/images/waste/pet.jpg',
      'hdpe': '/images/waste/hdpe.jpg',
      'ldpe': '/images/waste/ldpe.jpg',
      'pp': '/images/waste/pp.jpg',
      'cardboard': '/images/waste/cardboard.jpg',
      'newspaper': '/images/waste/newspaper.jpg',
      'mixed': '/images/waste/mixed-paper.jpg',
      'clear': '/images/waste/clear-glass.jpg',
      'colored': '/images/waste/colored-glass.jpg',
      'can': '/images/waste/aluminum-can.jpg',
      'plate': '/images/waste/aluminum-plate.jpg',
      'scrap': '/images/waste/aluminum-scrap.jpg',
      'cooking': '/images/waste/plastic.jpg',
      'motor': '/images/waste/plastic.jpg',
    }
    return imageMap[subTypeId] || '/images/waste/plastic.jpg'
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Step Title */}
        <h1 className="text-2xl font-semibold text-[#154212] text-center mb-6">
          {getStepTitle()}
        </h1>

        {/* Step 1: Select Waste Type */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {WASTE_TYPES.filter(t => t.id !== 'oil').map((type) => (
              <button
                key={type.id}
                onClick={() => handleTypeSelect(type.id)}
                className={cn(
                  'flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl border transition-all',
                  'bg-white hover:border-[#157b03] hover:shadow-lg',
                  'border-black/20 shadow-[0_0_24px_rgba(0,0,0,0.25)]',
                  'aspect-[3/4]'
                )}
              >
                <div className="w-full aspect-square relative mb-2 rounded-lg overflow-hidden max-w-[100px]">
                  <Image
                    src={WASTE_IMAGES[type.id]}
                    alt={type.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <span className="text-sm sm:text-base font-semibold text-black">{type.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Select Sub Type */}
        {step === 2 && selectedType && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {WASTE_SUBTYPES[selectedType].map((subType) => (
              <button
                key={subType.id}
                onClick={() => handleSubTypeSelect(subType)}
                className={cn(
                  'flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl border transition-all',
                  'bg-white hover:border-[#157b03] hover:shadow-lg',
                  selectedSubType?.id === subType.id 
                    ? 'border-[#157b03] shadow-lg bg-[#f0fdf0]' 
                    : 'border-black/20 shadow-[0_0_24px_rgba(0,0,0,0.25)]',
                  'aspect-[3/4]'
                )}
              >
                <div className="w-full aspect-square relative mb-2 rounded-lg overflow-hidden bg-[#f5f5f5] max-w-[90px]">
                  <Image
                    src={getSubTypeImage(selectedType, subType.id)}
                    alt={subType.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-black text-center whitespace-pre-line leading-tight">
                  {subType.name}
                </span>
                {subType.description && (
                  <span className="text-[10px] sm:text-xs text-[#666666]">{subType.description}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Weight and Evidence */}
        {step === 3 && selectedSubType && (
          <div className="space-y-6">
            <WeightInput
              value={weight}
              onChange={setWeight}
            />

            <ImageEvidence
              imageUrl={imageEvidence}
              onImageChange={setImageEvidence}
              referenceImage="/placeholder.svg?height=120&width=120&query=weighing scale with recycling items example"
              referenceLabel="ตัวอย่างการชั่ง"
            />
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center mt-6">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="ml-8 font-semibold text-[#154212] hover:text-[#0d3308] transition-colors text-sm sm:text-base"
            >
              ย้อนกลับ
            </button>
          ) : (
            <div />
          )}
          
          {step === 3 && (
            <button
              onClick={handleNext}
              disabled={weight <= 0}
              className={cn(
                'px-8 py-2.5 rounded-full font-semibold transition-colors text-sm sm:text-base',
                weight > 0
                  ? 'bg-[#154212] text-white hover:bg-[#0d3308]'
                  : 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
              )}
            >
              ถัดไป
            </button>
          )}
        </div>
      </main>

      {/* Carbon Result Modal */}
      <CarbonResultModal
        isOpen={showResult}
        onClose={() => setShowResult(false)}
        carbonAmount={calculatedCarbon}
        pointsEarned={Math.round(calculatedCarbon * 10)}
        onSubmit={handleShowQR}
      />

      {/* QR Result Modal */}
      <CarbonResultModal
        isOpen={showQRResult}
        onClose={() => setShowQRResult(false)}
        carbonAmount={calculatedCarbon}
        pointsEarned={Math.round(calculatedCarbon * 10)}
        showQR
        qrData={JSON.stringify({
          type: selectedType,
          subType: selectedSubType?.id,
          weight,
          carbon: calculatedCarbon,
          timestamp: new Date().toISOString()
        })}
        onSubmit={handleSubmit}
      />

      {/* <BottomNav /> */}
    </div>
  )
}
