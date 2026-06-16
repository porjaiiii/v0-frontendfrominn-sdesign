'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface StyledQRCodeProps {
  value: string
  size?: number
  logoSrc?: string
  logoSize?: number
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

export function StyledQRCode({
  value,
  size = 260,
  logoSrc = '/logo-qr-center.png',
  logoSize,
}: StyledQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !value) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const DARK = '#2a8a1e'
    const LIGHT = '#ffffff'

    // Generate raw QR matrix via an offscreen canvas at fixed 500px for precision
    const RAW = 500
    const offscreen = document.createElement('canvas')
    QRCode.toCanvas(offscreen, value, {
      errorCorrectionLevel: 'H',
      margin: 4,
      width: RAW,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(() => {
      const offCtx = offscreen.getContext('2d')
      if (!offCtx) return

      const imageData = offCtx.getImageData(0, 0, RAW, RAW)
      const data = imageData.data

      // Detect quiet zone width by scanning downward from y=0 at x=0
      let quietZone = 0
      for (let y = 0; y < RAW; y++) {
        const idx = (y * RAW + y) * 4
        if (data[idx] < 128) { quietZone = y; break }
      }

      // Detect module size by scanning horizontally at y=quietZone
      let moduleSize = 1
      let darkStart = -1
      for (let x = quietZone; x < RAW; x++) {
        const idx = (quietZone * RAW + x) * 4
        if (data[idx] < 128) {
          if (darkStart === -1) darkStart = x
        } else {
          if (darkStart !== -1) { moduleSize = x - darkStart; break }
        }
      }

      const cols = Math.round((RAW - quietZone * 2) / moduleSize)

      // Build boolean matrix by sampling center of each module
      const matrix: boolean[][] = []
      for (let row = 0; row < cols; row++) {
        matrix[row] = []
        for (let col = 0; col < cols; col++) {
          const px = quietZone + col * moduleSize + Math.floor(moduleSize / 2)
          const py = quietZone + row * moduleSize + Math.floor(moduleSize / 2)
          const idx = (py * RAW + px) * 4
          matrix[row][col] = data[idx] < 128
        }
      }

      // Scale to target size
      canvas.width = size
      canvas.height = size

      const scale = size / RAW
      const ms = moduleSize * scale
      const qz = quietZone * scale

      // Background
      ctx.fillStyle = LIGHT
      ctx.fillRect(0, 0, size, size)

      // Finder pattern regions to skip when drawing data modules
      const finderRegions = [
        { r: 0, c: 0 },
        { r: 0, c: cols - 7 },
        { r: cols - 7, c: 0 },
      ]
      const isInFinder = (row: number, col: number) =>
        finderRegions.some(
          (fp) => row >= fp.r && row < fp.r + 7 && col >= fp.c && col < fp.c + 7
        )

      // Draw data modules with rounded corners
      ctx.fillStyle = DARK
      for (let row = 0; row < cols; row++) {
        for (let col = 0; col < cols; col++) {
          if (isInFinder(row, col)) continue
          if (!matrix[row][col]) continue

          const x = qz + col * ms
          const y = qz + row * ms
          const r = ms * 0.32

          drawRoundRect(ctx, x + 0.5, y + 0.5, ms - 1, ms - 1, r)
          ctx.fill()
        }
      }

      // Draw finder patterns (3 corners) with rounded style
      for (const fp of finderRegions) {
        const ox = qz + fp.c * ms
        const oy = qz + fp.r * ms
        const outerSz = 7 * ms
        const outerR = outerSz * 0.2

        // Outer filled square
        ctx.fillStyle = DARK
        drawRoundRect(ctx, ox, oy, outerSz, outerSz, outerR)
        ctx.fill()

        // White inner gap (1 module border)
        ctx.fillStyle = LIGHT
        drawRoundRect(ctx, ox + ms, oy + ms, outerSz - 2 * ms, outerSz - 2 * ms, outerR * 0.5)
        ctx.fill()

        // Inner 3×3 dark dot
        ctx.fillStyle = DARK
        drawRoundRect(ctx, ox + 2 * ms, oy + 2 * ms, 3 * ms, 3 * ms, (3 * ms) * 0.25)
        ctx.fill()
      }

      // Draw center logo
      const effectiveLogoSize = logoSize ?? Math.round(size * 0.22)
      const logoX = (size - effectiveLogoSize) / 2
      const logoY = (size - effectiveLogoSize) / 2

      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        // White rounded background behind logo
        const pad = 5
        const bgR = effectiveLogoSize * 0.2
        ctx.fillStyle = LIGHT
        drawRoundRect(ctx, logoX - pad, logoY - pad, effectiveLogoSize + pad * 2, effectiveLogoSize + pad * 2, bgR)
        ctx.fill()

        ctx.drawImage(img, logoX, logoY, effectiveLogoSize, effectiveLogoSize)
      }
      img.src = logoSrc
    })
  }, [value, size, logoSrc, logoSize])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="rounded-2xl"
    />
  )
}
