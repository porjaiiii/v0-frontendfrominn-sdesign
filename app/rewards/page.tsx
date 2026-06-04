'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, ShoppingCart } from 'lucide-react'
import { motion } from 'framer-motion'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { REWARDS } from '@/lib/waste-data'
import { cn } from '@/lib/utils'

export default function RewardsPage() {
  const userPoints = 67 // Based on Figma design
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [mounted, setMounted] = useState(false)
  const [clickedButton, setClickedButton] = useState<number | null>(null)
  const buttonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({})

  // Load favorites from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('favorites')
    if (saved) {
      try {
        setFavorites(new Set(JSON.parse(saved)))
      } catch (e) {
        console.error('Failed to load favorites:', e)
      }
    }
    setMounted(true)
  }, [])

  const toggleFavorite = (id: number) => {
    const newFavorites = new Set(favorites)
    if (newFavorites.has(id)) {
      newFavorites.delete(id)
    } else {
      newFavorites.add(id)
    }
    setFavorites(newFavorites)
    // Save to localStorage
    localStorage.setItem('favorites', JSON.stringify(Array.from(newFavorites)))
  }

  const handleCartClick = (id: number) => {
    setClickedButton(id)
    setTimeout(() => setClickedButton(null), 200)
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Points Display Card */}
        <div className="bg-gradient-to-b from-[#154212] to-[#1a5a16] rounded-2xl p-5 mb-6 relative">
          {/* Icon Buttons - Top Right */}
          <div className="absolute top-4 right-4 flex gap-2">
            {/* Cart Button */}
            <Link
              href="/cart"
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
              title="ดูตะกร้า"
            >
              <ShoppingCart size={20} />
            </Link>

            {/* Favorites Button */}
            <Link 
              href="/favorites"
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
              title="รายการที่ถูกใจ"
            >
              <Heart size={20} />
            </Link>
          </div>

          <p className="text-sm text-white/80 mb-2">คะแนนแสะสมของคุณ</p>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-5xl font-bold text-white">{userPoints}</span>
            <span className="text-lg text-white/80">คะแนน</span>
          </div>
          <div className="flex gap-2">
            <Link 
              href="/history"
              className="px-4 py-1.5 bg-white rounded-lg text-sm font-medium text-[#154212] hover:bg-[#f5f5f5] transition-colors"
            >
              ประวัติการสะสมแนน
            </Link>
            <button className="px-4 py-1.5 bg-white rounded-lg text-sm font-medium text-[#154212] hover:bg-[#f5f5f5] transition-colors">
              บริจาคคะแนน
            </button>
          </div>
        </div>

        {/* Rewards Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#154212]">รางวัลที่สามารถแลกได้</h2>
          
          <div className="grid grid-cols-2 gap-4">
            {REWARDS.map((reward) => {
              const canRedeem = userPoints >= reward.points
              const isFavorited = favorites.has(reward.id)
              const isClicked = clickedButton === reward.id

              return (
                <div
                  key={reward.id}
                  className={cn(
                    'bg-white rounded-xl border overflow-hidden transition-all relative',
                    canRedeem 
                      ? 'border-[#e5e5e5] hover:shadow-md' 
                      : 'border-[#e5e5e5]'
                  )}
                >
                  {/* Favorite Heart */}
                  <button
                    onClick={() => toggleFavorite(reward.id)}
                    className="absolute top-2 right-2 z-10 transition-transform hover:scale-110"
                    title="เพิ่มสินค้าไปยังรายการโปรด"
                  >
                    <Heart
                      size={20}
                      className={cn(
                        isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-300'
                      )}
                    />
                  </button>

                  {/* Product Image */}
                  <div className="aspect-square relative bg-[#f5f5f5]">
                    <Image
                      src={reward.image}
                      alt={reward.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-[#444444] mb-1">
                      {reward.name}
                    </h3>
                    {reward.description && (
                      <p className="text-xs text-[#666666] mb-2">{reward.description}</p>
                    )}
                    <div className="flex items-center justify-between mb-3">
                      <span className={cn(
                        'text-sm font-semibold',
                        canRedeem ? 'text-[#157b03]' : 'text-[#999999]'
                      )}>
                        {reward.points} แต้ม
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        disabled={!canRedeem}
                        className={cn(
                          'flex-[7] py-2 rounded-lg text-sm font-medium transition-colors',
                          canRedeem
                            ? 'bg-[#154212] text-white hover:bg-[#0d3308]'
                            : 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
                        )}
                      >
                        แลกเลย
                      </button>
                      <motion.button
                        ref={(el) => {
                          if (el) buttonRefs.current[reward.id] = el
                        }}
                        onClick={() => handleCartClick(reward.id)}
                        disabled={!canRedeem}
                        animate={isClicked ? { scale: 0.85 } : { scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          'flex-[3] py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center',
                          canRedeem
                            ? 'bg-white border border-[#154212] text-[#154212] hover:bg-[#f5f5f5]'
                            : 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
                        )}
                      >
                        <ShoppingCart size={16} />
                      </motion.button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
