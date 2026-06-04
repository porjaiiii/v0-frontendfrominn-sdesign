'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, ShoppingCart, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { REWARDS } from '@/lib/waste-data'
import { cn } from '@/lib/utils'

export default function FavoritesPage() {
  const userPoints = 67
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [clickedButton, setClickedButton] = useState<number | null>(null)

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('favorites')
    if (saved) {
      try {
        setFavorites(new Set(JSON.parse(saved)))
      } catch (e) {
        console.error('Failed to load favorites:', e)
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
    localStorage.setItem('favorites', JSON.stringify(Array.from(newFavorites)))
  }

  const handleCartClick = (id: number) => {
    setClickedButton(id)
    setTimeout(() => setClickedButton(null), 200)
  }

  const favoriteRewards = REWARDS.filter(reward => favorites.has(reward.id))

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/rewards" className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-[#154212]" />
          </Link>
          <h1 className="text-xl font-semibold text-[#154212]">รายการที่ถูกใจ</h1>
        </div>

        {/* Empty State */}
        {favoriteRewards.length === 0 ? (
          <div className="text-center py-12">
            <Heart size={48} className="mx-auto mb-4 text-[#e5e5e5]" />
            <p className="text-[#999999] text-sm">ยังไม่มีรายการที่ถูกใจ</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {favoriteRewards.map((reward) => {
              const canRedeem = userPoints >= reward.points
              const isFavorited = favorites.has(reward.id)

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
                        onClick={() => handleCartClick(reward.id)}
                        disabled={!canRedeem}
                        animate={clickedButton === reward.id ? { scale: 0.85 } : { scale: 1 }}
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
        )}
      </main>

      <BottomNav />
    </div>
  )
}
