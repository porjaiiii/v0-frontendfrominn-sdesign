'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { WeightInput, ImageEvidence } from '@/components/weight-input'
import { CarbonResultModal } from '@/components/carbon-result-modal'
import { ConfirmIncompleteModal } from '@/components/confirm-incomplete-modal'
import { SaveSuccessModal } from '@/components/save-success-modal'
import { WASTE_TYPES, WASTE_SUBTYPES } from '@/lib/waste-data'
import { type WasteType, type WasteSubType } from '@/lib/app-context'
import { useLiffContext } from '@/lib/liff-context'
import { useProfileGuard } from '@/hooks/use-profile-guard'
import liff from '@line/liff'
import { cn } from '@/lib/utils'

// Carbon reduction factors per kg (CO2 kg saved)
const CARBON_FACTORS: Record<WasteType, number> = {
  plastic: 1.0310,
  paper: 3.5460,
  glass: 0.2760,
  aluminum: 9.1270,
  oil: 3.0,
}

// Points per kg for each waste type (คำนวณแยกจาก carbon)
const POINTS_PER_KG: Record<WasteType, number> = {
  plastic: 6,
  paper: 4,
  glass: 4,
  aluminum: 25,
  oil: 3,
}

// Waste type images
const WASTE_IMAGES: Record<WasteType, string> = {
  plastic: '/waste/plastic/plastic.png',
  paper: '/waste/paper/paper.png',
  glass: '/waste/glass/glass.png',
  aluminum: '/waste/aluminium/aluminum.png',
  oil: '/waste/plastic/plastic.png',
}

export default function HomePage() {
  const liffContext = useLiffContext()
 
  const router = useRouter()
  const [step, setStep] = useState(1)


  const [selectedType, setSelectedType] = useState<WasteType | null>(null)
  const [selectedSubType, setSelectedSubType] = useState<WasteSubType | null>(null)
  const [weight, setWeight] = useState(0)
  const [noWeight, setNoWeight] = useState(false)
const [imageEvidence, setImageEvidence] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmIncomplete, setShowConfirmIncomplete] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  const calculatedCarbon = selectedType
    ? weight * CARBON_FACTORS[selectedType]
    : 0

  const calculatedPoints = selectedType
    ? Math.round(weight * POINTS_PER_KG[selectedType])
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

  const isDataComplete = (weight > 0 || noWeight) && imageEvidence.length > 0
   const isDataReady= (weight > 0 || noWeight) 

  // Called when "บันทึก" button is pressed
  const handleSaveClick = () => {
    if (!isDataComplete) {
      // Show confirmation popup for incomplete data
      setShowConfirmIncomplete(true)
    } else {
      // Data is complete — save directly
      handleDoSave()
    }
  }

  // Called when user confirms from incomplete-data popup OR data is complete
  const handleDoSave = async () => {
    setShowConfirmIncomplete(false)
    setIsSubmitting(true)

    try {
      const userId = liffContext?.profile?.userId || 'unknown-user'

      const response = await fetch('/api/waste/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          waste_type: selectedType,
          waste_subtype: selectedSubType?.id,
          weight_kg: noWeight ? -1 : weight,
          image_url: imageEvidence || null,
          notes: '',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit waste record')
      }

      // Show the existing carbon result modal first
      setShowResult(true)
    } catch (error) {
      console.error('[v0] Error submitting waste:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Called when user presses "กลับสู่ line" on success modal
  const handleReturnToLine = () => {
    // Like the reference LIFF page: attempt to close the LINE window
    // UNCONDITIONALLY. We don't gate on liff.isInClient() because on the home
    // page it can report false (e.g. when the page wasn't the LIFF entry point),
    // which would silently skip the close and leave the user stuck. closeWindow()
    // is a no-op / throws harmlessly outside the LINE client, so try it first and
    // return immediately — any setState/router.push after it would unmount this
    // modal mid-handler and interrupt the close before LINE acts on it.
    try {
      console.log('[v0] returnToLine — isInClient:', liff.isInClient(), 'isLoggedIn:', liff.isLoggedIn())
      liff.closeWindow()
    } catch (err) {
      console.error('[v0] liff.closeWindow() failed:', err)
    }

    // If closeWindow() actually took us back to LINE, this component unmounts and
    // the timeout never fires. In a plain browser closeWindow() is a silent no-op,
    // so after a short delay we fall back to resetting the form and going home.
    setTimeout(() => {
      setShowSaveSuccess(false)
      setStep(1)
      setSelectedType(null)
      setSelectedSubType(null)
      setWeight(0)
      setNoWeight(false)
      setImageEvidence([]); // ส่ง Array ว่างไปแทนครับ
      router.push('/home')
    }, 400)
  }

  const handleNext = () => {
    if (step === 3 && (weight > 0 || noWeight)) {
      setShowResult(true)
    }
  }

  // Called when "เสร็จสิ้น" is pressed on CarbonResultModal
  const handleShowQR = () => {
    setShowResult(false)
    setShowSaveSuccess(true)
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
      // plastic subtypes
      'pet': '/waste/plastic/pet.png',
      'hdpe': '/waste/plastic/hdpe.png',
      'ldpe': '/waste/plastic/ldpe.png',
      'pp': '/waste/plastic/plastic.png',
      // paper subtypes
      'cardboard': '/waste/paper/cardboard.png',
      'a4': '/waste/paper/a4.png',
      'mixed': '/waste/paper/mixed.png',
      // glass subtypes
      'clear': '/waste/glass/clear.png',
      'colored': '/waste/glass/colored.png',
      // aluminum subtypes
      'can': '/waste/aluminium/can.png',
      'plate': '/waste/aluminium/plate.png',
      'scrap': '/waste/aluminium/scrap.png',
      // oil subtypes (no dedicated image yet)
      'cooking': '/waste/plastic/plastic.png',
      'motor': '/waste/plastic/plastic.png',
    }
    return imageMap[subTypeId] || '/waste/plastic/plastic.png'
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
  imageUrls={imageEvidence}          // เปลี่ยนจาก imageUrl เป็น imageUrls
  onImagesChange={setImageEvidence}  // เปลี่ยนจาก onImageChange เป็น onImagesChange
  referenceImage="/images/weighing-scale-example.png"
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
                onClick={handleSaveClick}
                disabled={isSubmitting || !isDataReady}
                className={cn(
                  'px-8 py-2.5 rounded-full font-semibold text-sm transition-colors',
                  !isDataReady
                    ? 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
                    : 'bg-[#154212] text-white hover:bg-[#0d3308]'
                )}
              >
                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Carbon Result Modal (legacy flow kept) */}
      <CarbonResultModal
        isOpen={showResult}
        onClose={() => setShowResult(false)}
        carbonAmount={calculatedCarbon}
        noWeight={noWeight}
        pointsEarned={calculatedPoints}
        onNext={handleShowQR}
      />

      {/* Confirm incomplete data popup */}
      <ConfirmIncompleteModal
        isOpen={showConfirmIncomplete}
        onEdit={() => setShowConfirmIncomplete(false)}
        onConfirm={handleDoSave}
      />

      {/* Save success popup — "กลับสู่ line" */}
      <SaveSuccessModal
        isOpen={showSaveSuccess}
        onReturnToLine={handleReturnToLine}
      />

      {/* <BottomNav /> */}
    </div>
  )
}
