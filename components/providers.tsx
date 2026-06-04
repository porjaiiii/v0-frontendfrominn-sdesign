'use client'

import { AppProvider } from '@/lib/app-context'
import { LiffProvider } from '@/lib/liff-context'
import { CartProvider } from '@/lib/cart-context'
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
          <CartProvider>
            {children}
          </CartProvider>
        </LiffProvider>
      </AppProvider>
    </ThemeProvider>
  )
}
