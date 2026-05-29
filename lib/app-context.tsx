'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type WasteType = 'plastic' | 'paper' | 'glass' | 'aluminum' | 'oil'

export interface WasteSubType {
  id: string
  name: string
  description?: string
  image: string
}

export interface WasteSubmission {
  wasteType: WasteType
  subType: WasteSubType
  weight: number
  imageEvidence?: string
  carbonReduction: number
  createdAt: Date
}

export interface UserProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  totalCarbon: number
  totalPoints: number
  rank: number
  submissions: WasteSubmission[]
}

interface AppContextType {
  // Current submission flow
  selectedWasteType: WasteType | null
  setSelectedWasteType: (type: WasteType | null) => void
  selectedSubType: WasteSubType | null
  setSelectedSubType: (subType: WasteSubType | null) => void
  weight: number
  setWeight: (weight: number) => void
  imageEvidence: string | null
  setImageEvidence: (image: string | null) => void
  
  // User data
  userProfile: UserProfile | null
  setUserProfile: (profile: UserProfile | null) => void
  
  // Calculated carbon
  calculatedCarbon: number
  
  // Navigation
  currentStep: number
  setCurrentStep: (step: number) => void
  
  // Reset submission
  resetSubmission: () => void
  
  // Submit
  submitWaste: () => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

// Carbon factors per kg for each waste type
const CARBON_FACTORS: Record<WasteType, number> = {
  plastic: 2.5,
  paper: 1.8,
  glass: 0.8,
  aluminum: 4.0,
  oil: 3.0,
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedWasteType, setSelectedWasteType] = useState<WasteType | null>(null)
  const [selectedSubType, setSelectedSubType] = useState<WasteSubType | null>(null)
  const [weight, setWeight] = useState(0)
  const [imageEvidence, setImageEvidence] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [userProfile, setUserProfile] = useState<UserProfile | null>({
    userId: 'demo-user',
    displayName: 'ผู้ใช้ทดสอบ',
    totalCarbon: 45.5,
    totalPoints: 1250,
    rank: 15,
    submissions: []
  })

  const calculatedCarbon = selectedWasteType 
    ? weight * CARBON_FACTORS[selectedWasteType]
    : 0

  const resetSubmission = useCallback(() => {
    setSelectedWasteType(null)
    setSelectedSubType(null)
    setWeight(0)
    setImageEvidence(null)
    setCurrentStep(1)
  }, [])

  const submitWaste = useCallback(() => {
    if (!selectedWasteType || !selectedSubType || weight <= 0) return

    const newSubmission: WasteSubmission = {
      wasteType: selectedWasteType,
      subType: selectedSubType,
      weight,
      imageEvidence: imageEvidence || undefined,
      carbonReduction: calculatedCarbon,
      createdAt: new Date()
    }

    setUserProfile(prev => {
      if (!prev) return prev
      return {
        ...prev,
        totalCarbon: prev.totalCarbon + calculatedCarbon,
        totalPoints: prev.totalPoints + Math.floor(calculatedCarbon * 10),
        submissions: [...prev.submissions, newSubmission]
      }
    })
  }, [selectedWasteType, selectedSubType, weight, imageEvidence, calculatedCarbon])

  return (
    <AppContext.Provider value={{
      selectedWasteType,
      setSelectedWasteType,
      selectedSubType,
      setSelectedSubType,
      weight,
      setWeight,
      imageEvidence,
      setImageEvidence,
      userProfile,
      setUserProfile,
      calculatedCarbon,
      currentStep,
      setCurrentStep,
      resetSubmission,
      submitWaste
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
