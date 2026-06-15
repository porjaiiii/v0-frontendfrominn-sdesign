'use client'

import { AppProvider } from '@/lib/app-context'
import { LiffProvider } from '@/lib/liff-context'
import { PointsProvider } from '@/lib/points-context'
import { CartProvider } from '@/lib/cart-context'
import { CouponProvider } from '@/lib/coupon-context'
import { ThemeProvider } from '@/components/theme-provider'
import { type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <AppProvider>
        <LiffProvider>
          <PointsProvider>
            <CartProvider>
              <CouponProvider>
                {children}
              </CouponProvider>
            </CartProvider>
          </PointsProvider>
        </LiffProvider>
      </AppProvider>
    </ThemeProvider>
  )
}
