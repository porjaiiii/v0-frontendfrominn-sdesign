import type { Metadata, Viewport } from 'next'
import { Noto_Sans_Thai } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from '@/components/providers'
import './globals.css'

const notoSansThai = Noto_Sans_Thai({ 
  subsets: ['thai', 'latin'],
  variable: '--font-noto-sans-thai',
  weight: ['300', '400', '500', '600', '700']
})

export const metadata: Metadata = {
  title: 'Digital Wasted Account',
  description: 'แอปพลิเคชันรีไซเคิลขยะและลดคาร์บอน สำหรับ LINE OA',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#157b03',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th" className="bg-background" suppressHydrationWarning>
      <body className={`${notoSansThai.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
