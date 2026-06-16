'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface StyledQRCodeProps {
  value: string
  size?: number
  logoSrc?: string
  logoSize?: number
}

/**
 * Renders a styled QR code on a <canvas>:
 *  - Dark modules: #1a7c2a (green)
 *  - Light modules: #ffffff
 *  - Rounded finder-pattern squares (the three corner markers)
 *  - Logo image centered on top (defaults to /logo-qr-center.png)
 */
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
    const MODULE_RADIUS_RATIO = 0.35 // how round individual data modules are
    const FINDER_RADIUS_RATIO = 0.18  // corner radius for finder squares (outer / inner)

    // 1. Generate raw QR matrix via the library (use a hidden offscreen canvas)
    const offscreen = document.createElement('canvas')
    QRCode.toCanvas(offscreen, value, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: size,
      color: { dark: DARK, light: LIGHT },
    }).then(() => {
      // 2. Read the pixel data to determine module size & matrix
      const offCtx = offscreen.getContext('2d')
      if (!offCtx) return

      const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height)
      const data = imageData.data
      const w = offscreen.width

      // Sample the top-left corner area to find the quiet-zone (white) width
      // by scanning downward until we hit a dark pixel — that's moduleSize
      let quietZone = 0
      for (let y = 0; y < w; y++) {
        const idx = (y * w + 0) * 4
        if (data[idx] < 128) { quietZone = y; break }
      }

      // Find module size by scanning a horizontal line at quietZone row
      let darkStart = -1
      let moduleSize = 1
      for (let x = quietZone; x < w; x++) {
        const idx = (quietZone * w + x) * 4
        if (data[idx] < 128) {
          if (darkStart === -1) darkStart = x
        } else {
          if (darkStart !== -1) { moduleSize = x - darkStart; break }
        }
      }

      const cols = Math.round((w - quietZone * 2) / moduleSize)

      // Build boolean matrix
      const matrix: boolean[][] = []
      for (let row = 0; row < cols; row++) {
        matrix[row] = []
        for (let col = 0; col < cols; col++) {
          const px = quietZone + col * moduleSize + Math.floor(moduleSize / 2)
          const py = quietZone + row * moduleSize + Math.floor(moduleSize / 2)
          const idx = (py * w + px) * 4
          matrix[row][col] = data[idx] < 128
        }
      }

      // 3. Paint our own canvas
      canvas.width = size
      canvas.height = size

      // Background
      ctx.fillStyle = LIGHT
      ctx.fillRect(0, 0, size, size)

      // Helper: rounded rectangle
      const roundRect = (x: number, y: number, rw: number, rh: number, r: number) => {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + rw - r, y)
        ctx.quadraticCurveTo(x + rw, y, x + rw, y + r)
        ctx.lineTo(x + rw, y + rh - r)
        ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh)
        ctx.lineTo(x + r, y + rh)
        ctx.quadraticCurveTo(x, y + rh, x, y + rh - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
      }

      const ms = moduleSize

      // Finder pattern positions (top-left col,row of the 7×7 outer square)
      const finderPositions = [
        { r: 0, c: 0 },
        { r: 0, c: cols - 7 },
        { r: cols - 7, c: 0 },
      ]
      const isInFinder = (row: number, col: number) => {
        for (const fp of finderPositions) {
          if (row >= fp.r && row < fp.r + 7 && col >= fp.c && col < fp.c + 7) return true
        }
        return false
      }

      // Draw data modules (skip finder cells)
      ctx.fillStyle = DARK
      for (let row = 0; row < cols; row++) {
        for (let col = 0; col < cols; col++) {
          if (isInFinder(row, col)) continue
          if (!matrix[row][col]) continue

          const x = quietZone + col * ms
          const y = quietZone + row * ms
          const r = ms * MODULE_RADIUS_RATIO

          roundRect(x + 0.5, y + 0.5, ms - 1, ms - 1, r)
          ctx.fill()
        }
      }

      // Draw finder patterns with rounded squares
      for (const fp of finderPositions) {
        const ox = quietZone + fp.c * ms
        const oy = quietZone + fp.r * ms
        const outerSize = 7 * ms
        const outerR = outerSize * FINDER_RADIUS_RATIO

        // Outer ring
        ctx.fillStyle = DARK
        roundRect(ox, oy, outerSize, outerSize, outerR)
        ctx.fill()

        // White gap (1 module wide)
        ctx.fillStyle = LIGHT
        roundRect(ox + ms, oy + ms, outerSize - 2 * ms, outerSize - 2 * ms, outerR * 0.6)
        ctx.fill()

        // Inner 3×3 dot
        ctx.fillStyle = DARK
        roundRect(ox + 2 * ms, oy + 2 * ms, 3 * ms, 3 * ms, (3 * ms) * FINDER_RADIUS_RATIO)
        ctx.fill()
      }

      // 4. Draw center logo
      const effectiveLogoSize = logoSize ?? Math.round(size * 0.22)
      const logoX = (size - effectiveLogoSize) / 2
      const logoY = (size - effectiveLogoSize) / 2

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        // White circle behind logo
        const pad = 4
        const logoR = (effectiveLogoSize / 2) * 0.55
        ctx.fillStyle = LIGHT
        ctx.beginPath()
        ctx.roundRect(
          logoX - pad,
          logoY - pad,
          effectiveLogoSize + pad * 2,
          effectiveLogoSize + pad * 2,
          logoR
        )
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
