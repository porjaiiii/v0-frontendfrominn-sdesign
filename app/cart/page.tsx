'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, Heart, Trash2 } from 'lucide-react'
import { BottomNav } from '@/components/bottom-nav'
import { useCart, CartItem as ContextCartItem } from '@/lib/cart-context'
import { REWARDS } from '@/lib/waste-data'
import { cn } from '@/lib/utils'

interface CartItemWithFav extends ContextCartItem {
  favorited?: boolean
}

export default function CartPage() {
  const { items: contextItems, updateQuantity, removeFromCart } = useCart()
  const [cartItems, setCartItems] = useState<CartItemWithFav[]>([])
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [mounted, setMounted] = useState(false)

  // Load favorites on mount
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

  // Sync context items with local state
  useEffect(() => {
    setCartItems(contextItems.map(item => ({
      ...item,
      favorited: favorites.has(item.id)
    })))
  }, [contextItems, favorites])

  const handleQuantityChange = (id: number, delta: number) => {
    const item = cartItems.find(i => i.id === id)
    if (item) {
      updateQuantity(id, Math.max(1, item.quantity + delta))
    }
  }

  const handleRemoveItem = (id: number) => {
    removeFromCart(id)
  }

  const handleToggleFavorite = (id: number) => {
    const newFavorites = new Set(favorites)
    if (newFavorites.has(id)) {
      newFavorites.delete(id)
    } else {
      newFavorites.add(id)
    }
    setFavorites(newFavorites)
    localStorage.setItem('favorites', JSON.stringify(Array.from(newFavorites)))
  }

  const totalPoints = cartItems.reduce((sum, item) => {
    return sum + item.points * item.quantity
  }, 0)

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-[#e5e5e5] z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/rewards" className="hover:opacity-70 transition-opacity">
            <ChevronLeft size={24} className="text-[#154212]" />
          </Link>
          <h1 className="text-lg font-semibold text-[#154212]">ตะกร้าของฉัน</h1>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 py-4">
        {cartItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">ตะกร้าว่างเปล่า</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Table Headers */}
            <div className="grid grid-cols-12 gap-2 mb-4 px-2 text-xs text-[#666666] font-medium">
              <div className="col-span-4">ชื่อสินค้า</div>
              <div className="col-span-2 text-center">คะแนน</div>
              <div className="col-span-3 text-center">จำนวน</div>
              <div className="col-span-3 text-center">คะแนนรวม</div>
            </div>

            {/* Cart Items */}
            {cartItems.map((item) => {
              const reward = REWARDS.find(r => r.id === item.id)
              if (!reward) return null

              const itemTotal = reward.points * item.quantity

              return (
                <div
                  key={reward.id}
                  className="border border-[#e5e5e5] rounded-lg p-3 space-y-2"
                >
                  {/* First Row - Product Info */}
                  <div className="grid grid-cols-12 gap-2 items-start text-xs">
                    <div className="col-span-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 relative bg-[#f5f5f5] rounded">
                          <Image
                            src={reward.image}
                            alt={reward.name}
                            fill
                            className="object-cover rounded"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-[#444444]">
                            {reward.name}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 text-center text-[#444444]">
                      {reward.points}
                    </div>
                    <div className="col-span-3 flex justify-center items-center gap-1">
                      <button
                        onClick={() => handleQuantityChange(item.id, -1)}
                        className="w-6 h-6 flex items-center justify-center border border-[#e5e5e5] rounded text-[#666666] hover:bg-[#f5f5f5]"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-[#444444]">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.id, 1)}
                        className="w-6 h-6 flex items-center justify-center border border-[#e5e5e5] rounded text-[#666666] hover:bg-[#f5f5f5]"
                      >
                        +
                      </button>
                    </div>
                    <div className="col-span-3 text-center text-[#444444]">
                      {itemTotal}
                    </div>
                  </div>

                  {/* Second Row - Additional Info & Actions */}
                  <div className="flex items-center justify-between text-xs text-[#666666]">
                    <div className="flex-1">
                      <p>อัพเดตปัจจุบัน วันที่ 2 มิถุนายน 2569</p>
                      <p>12:30 น. คงเหลือ : 10 แพ็ค</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => handleToggleFavorite(item.id)}
                        className="transition-transform hover:scale-110"
                        title="เพิ่มสินค้าไปยังรายการโปรด"
                      >
                        <Heart
                          size={16}
                          className={cn(
                            item.favorited
                              ? 'fill-red-500 text-red-500'
                              : 'text-gray-300'
                          )}
                        />
                      </button>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-500 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Summary */}
        {cartItems.length > 0 && (
          <div className="mt-6 space-y-3 border-t border-[#e5e5e5] pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-[#666666]">รวมที่สั่ง</span>
              <span className="font-semibold text-[#444444]">{totalPoints} คะแนน</span>
            </div>

            <Link
              href="/checkout"
              className="block w-full bg-[#154212] text-white py-3 rounded-lg text-center font-medium hover:bg-[#0d3308] transition-colors"
            >
              ชำระแต้ม
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
