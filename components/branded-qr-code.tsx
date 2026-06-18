'use client'

import { useEffect, useRef } from 'react'
import type QRCodeStylingType from 'qr-code-styling'

interface BrandedQRCodeProps {
  /** Data encoded into the QR (e.g. coupon_id) */
  value: string
  /** Rendered width/height in px */
  size?: number
  /** Center logo image path */
  logoSrc?: string
}

/**
 * QR code rendered with the `qr-code-styling` library (extra-rounded dots,
 * circular shape, brand-green palette, centered logo).
 *
 * This is a drop-in alternative to <StyledQRCode>. The old hand-rolled SVG
 * component is left untouched so existing usages keep working.
 */
export function BrandedQRCode({
  value,
  size = 300,
  logoSrc = '/logo-qr-center.png',
}: BrandedQRCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const qrRef = useRef<QRCodeStylingType | null>(null)

  // Build the styling options once per render input
  const buildOptions = (data: string, dimension: number, image: string) => ({
    width: dimension,
    height: dimension,
    type: 'svg' as const,
    data,
    image,
    shape: 'square' as const,
    dotsOptions: {
      color: '#14AE5C',
      roundSize: true,
      type: 'extra-rounded' as const,
    },
    backgroundOptions: {
      color: '#ffffff',
    },
    imageOptions: {
      margin: 5,
      imageSize: 0.5,
      hideBackgroundDots: true,
    },
    cornersSquareOptions: {
      color: '#154212',
    },
    cornersDotOptions: {
      color: '#154212',
    },
  })

  // Create the instance on mount (client-only dynamic import for SSR safety)
  useEffect(() => {
    let cancelled = false

    import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      if (cancelled || !containerRef.current) return
      qrRef.current = new QRCodeStyling(buildOptions(value, size, logoSrc))
      containerRef.current.innerHTML = ''
      qrRef.current.append(containerRef.current)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update when inputs change (after the instance exists)
  useEffect(() => {
    if (!qrRef.current) return
    qrRef.current.update(buildOptions(value, size, logoSrc))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, size, logoSrc])

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size }}
      aria-label="QR code"
    />
  )
}
