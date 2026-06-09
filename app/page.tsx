'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { WeightInput, ImageEvidence } from '@/components/weight-input'
import { CarbonResultModal } from '@/components/carbon-result-modal'
import { WASTE_TYPES, WASTE_SUBTYPES } from '@/lib/waste-data'
import { type WasteType, type WasteSubType } from '@/lib/app-context'
import { useLiffContext } from '@/lib/liff-context'
import { cn } from '@/lib/utils'

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
  const liffContext = useLiffContext()
  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState<WasteType | null>(null)
  const [selectedSubType, setSelectedSubType] = useState<WasteSubType | null>(null)
  const [weight, setWeight] = useState(0)
  const [noWeight, setNoWeight] = useState(false)
  const [imageEvidence, setImageEvidence] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
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
    if (step === 3 && (weight > 0 || noWeight)) {
      setShowResult(true)
    }
  }

  const handleShowQR = async () => {
    console.log('[v0] handleShowQR called')
    setShowResult(false)
    setIsSubmitting(true)
    
    try {
      // ดึง user_id จาก LIFF context - ใช้ profile แทน userProfile
      const userId = liffContext?.profile?.userId || 'unknown-user'
      console.log('[v0] Submitting with userId:', userId)
      console.log('[v0] Waste data:', { 
        waste_type: selectedType, 
        waste_subtype: selectedSubType?.id, 
        weight_kg: weight 
      })
      
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
          weight_kg: noWeight ? -1 : weight,
          image_url: imageEvidence || null,
          notes: '',
        }),
      })

      console.log('[v0] API Response status:', response.status)

      if (!response.ok) {
        const error = await response.json()
        console.error('[v0] API Error:', error)
        throw new Error('Failed to submit waste record')
      }

      const result = await response.json()
      console.log('[v0] Waste submitted successfully:', result)

      // รีเซ็ต form
      setStep(1)
      setSelectedType(null)
      setSelectedSubType(null)
      setWeight(0)
      setNoWeight(false)
      setImageEvidence(null)
    } catch (error) {
      console.error('[v0] Error submitting waste:', error)
      // Still reset form even on error
      setStep(1)
      setSelectedType(null)
      setSelectedSubType(null)
      setWeight(0)
      setNoWeight(false)
      setImageEvidence(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = () => {
    // unused
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
  <div className="space-y-6">
    <div className="flex flex-wrap justify-center gap-3 sm:gap-4 w-full">
      {WASTE_SUBTYPES[selectedType].map((subType) => (
        <button
          key={subType.id}
          onClick={() => handleSubTypeSelect(subType)}
          className={cn(
            'w-[calc(50%-6px)] sm:w-[160px]',
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

    {/* Back button */}
    <div className="flex items-center">
      <button
        onClick={handleBack}
        className="px-6 py-2.5 rounded-full font-semibold text-[#154212] text-sm hover:text-[#0d3308] transition-colors"
      >
        ย้อนกลับ
      </button>
    </div>
  </div>
)}

        {/* Step 3: Weight and Evidence */}
        {step === 3 && selectedSubType && (
          <div className="space-y-8">
            <WeightInput
              value={weight}
              onChange={setWeight}
              noWeight={noWeight}
              onNoWeightChange={setNoWeight}
            />

            <ImageEvidence
              imageUrl={imageEvidence}
              onImageChange={setImageEvidence}
              referenceImage="/placeholder.svg?height=120&width=120&query=weighing scale with recycling items example"
              referenceLabel="ตัวอย่างการชั่ง"
              wasteType={selectedType || ''}
              weight={weight}
            />

            {/* Bottom navigation buttons */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleBack}
                className="px-6 py-2.5 rounded-full font-semibold text-[#154212] text-sm hover:text-[#0d3308] transition-colors"
              >
                ย้อนกลับ
              </button>
              
              <button
                onClick={() => {
                  setStep(1)
                  setSelectedType(null)
                  setSelectedSubType(null)
                  setWeight(0)
                  setNoWeight(false)
                  setImageEvidence(null)
                }}
                className="px-6 py-2.5 rounded-full font-semibold border-2 border-[#154212] text-[#154212] text-sm hover:bg-[#f0fdf0] transition-colors"
              >
                ข้าม
              </button>

              <button
                onClick={handleNext}
                disabled={weight <= 0 && !noWeight}
                className={cn(
                  'px-6 py-2.5 rounded-full font-semibold text-sm transition-colors',
                  weight > 0 || noWeight
                    ? 'bg-[#154212] text-white hover:bg-[#0d3308]'
                    : 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
                )}
              >
                บันทึก
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Carbon Result Modal */}
      <CarbonResultModal
        isOpen={showResult}
        onClose={() => setShowResult(false)}
        carbonAmount={calculatedCarbon}
        noWeight={noWeight}
        pointsEarned={Math.round(calculatedCarbon * 10)}
        onNext={handleShowQR}
      />


      {/* <BottomNav /> */}
    </div>
  )
}
