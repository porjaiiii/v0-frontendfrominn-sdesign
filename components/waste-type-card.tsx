'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface WasteTypeCardProps {
  name: string
  icon: string
  selected?: boolean
  onClick: () => void
}

export function WasteTypeCard({ name, icon, selected, onClick }: WasteTypeCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all',
        'bg-white hover:border-[#157b03] hover:shadow-md',
        selected 
          ? 'border-[#157b03] shadow-md bg-[#f0fdf0]' 
          : 'border-[#e5e5e5]'
      )}
    >
      <div className="w-16 h-16 relative mb-2">
        <Image
          src={icon}
          alt={name}
          fill
          className="object-contain"
        />
      </div>
      <span className="text-sm font-medium text-[#444444]">{name}</span>
    </button>
  )
}

interface WasteSubTypeCardProps {
  name: string
  description?: string
  image: string
  selected?: boolean
  onClick: () => void
}

export function WasteSubTypeCard({ name, description, image, selected, onClick }: WasteSubTypeCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all',
        'bg-white hover:border-[#157b03] hover:shadow-md',
        selected 
          ? 'border-[#157b03] shadow-md bg-[#f0fdf0]' 
          : 'border-[#e5e5e5]'
      )}
    >
      <div className="w-14 h-14 relative mb-2 bg-[#f5f5f5] rounded-lg overflow-hidden">
        <Image
          src={image}
          alt={name}
          fill
          className="object-contain p-1"
        />
      </div>
      <span className="text-xs font-medium text-[#444444] text-center whitespace-pre-line leading-tight">
        {name}
      </span>
      {description && (
        <span className="text-[10px] text-[#666666]">{description}</span>
      )}
    </button>
  )
}
