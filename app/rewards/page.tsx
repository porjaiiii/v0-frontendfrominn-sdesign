'use client'

import Image from 'next/image'
import { BottomNav } from '@/components/bottom-nav'
import { PageHeader } from '@/components/page-header'
import { REWARDS } from '@/lib/waste-data'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function RewardsPage() {
  const userPoints = 67 // Based on Figma design

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader />

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Points Display Card */}
        <div className="bg-gradient-to-b from-[#154212] to-[#1a5a16] rounded-2xl p-5 mb-6">
          <p className="text-sm text-white/80 mb-1">คะแนะสะสมของคุณ</p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold text-white">{userPoints}</span>
            <span className="text-lg text-white/80">คะแนน</span>
          </div>
          {/* History Button inside card */}
          <Link 
            href="/history"
            className="inline-block px-4 py-1.5 bg-white rounded-lg text-sm font-medium text-[#154212] hover:bg-[#f5f5f5] transition-colors"
          >
            ประวัติการสะสมคะแนน
          </Link>
        </div>

        {/* Rewards Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#154212]">รางวัลที่สามารถแลกได้</h2>
          
          <div className="grid grid-cols-2 gap-3">
            {REWARDS.map((reward) => {
              const canRedeem = userPoints >= reward.points
              return (
                <div
                  key={reward.id}
                  className={cn(
                    'bg-white rounded-xl border overflow-hidden transition-all',
                    canRedeem 
                      ? 'border-[#b6ebad] hover:shadow-md cursor-pointer' 
                      : 'border-[#e5e5e5] opacity-70'
                  )}
                >
                  <div className="aspect-square relative bg-[#f5f5f5]">
                    <Image
                      src={reward.image}
                      alt={reward.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-[#444444] mb-0.5 line-clamp-1">
                      {reward.name}
                    </h3>
                    {reward.description && (
                      <p className="text-xs text-[#666666] mb-2">{reward.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        'text-sm font-semibold',
                        canRedeem ? 'text-[#157b03]' : 'text-[#999999]'
                      )}>
                        {reward.points} แต้ม
                      </span>
                    </div>
                    <button
                      disabled={!canRedeem}
                      className={cn(
                        'w-full mt-2 py-2 rounded-lg text-sm font-medium transition-colors',
                        canRedeem
                          ? 'bg-[#154212] text-white hover:bg-[#0d3308]'
                          : 'bg-[#e5e5e5] text-[#999999] cursor-not-allowed'
                      )}
                    >
                      {canRedeem ? 'แลกเลย' : 'คะแนนไม่พอ'}
                    </button>
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
