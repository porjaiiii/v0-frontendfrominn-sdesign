'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { MOCK_USER } from '@/lib/mock-user'

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

// Points per kg for each waste type
const POINTS_PER_KG: Record<WasteType, number> = {
  plastic: 6,
  paper: 4,
  glass: 4,
  aluminum: 25,
  oil: 3,
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedWasteType, setSelectedWasteType] = useState<WasteType | null>(null)
  const [selectedSubType, setSelectedSubType] = useState<WasteSubType | null>(null)
  const [weight, setWeight] = useState(0)
  const [imageEvidence, setImageEvidence] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [userProfile, setUserProfile] = useState<UserProfile | null>({
    userId: MOCK_USER.lineUserId,
    displayName: MOCK_USER.displayName,
    totalCarbon: MOCK_USER.carbon,
    totalPoints: MOCK_USER.points,
    rank: 0,
    submissions: []
  })

  const calculatedCarbon = selectedWasteType
    ? weight * POINTS_PER_KG[selectedWasteType]
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
        totalPoints: prev.totalPoints + Math.floor(calculatedCarbon),
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
