'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface StyledQRCodeProps {
  value: string
  size?: number
  logoSrc?: string
  logoSize?: number
  darkColor?: string
  lightColor?: string
}

interface QRMatrix {
  matrix: boolean[][]
  moduleCount: number
}

async function getQRMatrix(value: string): Promise<QRMatrix> {
  // Generate QR at fixed size to extract the boolean matrix
  const RAW = 500
  const offscreen = document.createElement('canvas')
  await QRCode.toCanvas(offscreen, value, {
    errorCorrectionLevel: 'H',
    margin: 4,
    width: RAW,
    color: { dark: '#000000', light: '#ffffff' },
  })

  const ctx = offscreen.getContext('2d')!
  const imageData = ctx.getImageData(0, 0, RAW, RAW)
  const data = imageData.data

  // Detect quiet zone
  let quietZone = 0
  for (let y = 0; y < RAW; y++) {
    const idx = (y * RAW + y) * 4
    if (data[idx] < 128) { quietZone = y; break }
  }

  // Detect module size
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

  // Build boolean matrix
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

  return { matrix, moduleCount: cols }
}

function roundedRect(
  x: number, y: number, w: number, h: number, r: number
): string {
  const rr = Math.min(r, w / 2, h / 2)
  return [
    `M ${x + rr} ${y}`,
    `H ${x + w - rr}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `V ${y + h - rr}`,
    `Q ${x + w} ${y + h} ${x + w - rr} ${y + h}`,
    `H ${x + rr}`,
    `Q ${x} ${y + h} ${x} ${y + h - rr}`,
    `V ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    'Z',
  ].join(' ')
}

export function StyledQRCode({
  value,
  size = 260,
  logoSrc = '/logo-qr-center.png',
  logoSize,
  darkColor = '#2a8a1e',
  lightColor = '#ffffff',
}: StyledQRCodeProps) {
  const [svgContent, setSvgContent] = useState<React.ReactNode>(null)

  useEffect(() => {
    if (!value) return

    getQRMatrix(value).then(({ matrix, moduleCount: cols }) => {
      const PADDING = 4 // modules of quiet zone to show
      const totalCols = cols
      // viewBox units: each module = 10 units
      const M = 10
      const viewSize = (totalCols + PADDING * 2) * M
      const offset = PADDING * M

      const isInFinder = (row: number, col: number) => {
        const regions = [
          { r: 0, c: 0 },
          { r: 0, c: cols - 7 },
          { r: cols - 7, c: 0 },
        ]
        return regions.some(
          fp => row >= fp.r && row < fp.r + 7 && col >= fp.c && col < fp.c + 7
        )
      }

      // Data modules — circles/dots
      const dots: React.ReactNode[] = []
      for (let row = 0; row < cols; row++) {
        for (let col = 0; col < cols; col++) {
          if (isInFinder(row, col)) continue
          if (!matrix[row][col]) continue

          const cx = offset + col * M + M / 2
          const cy = offset + row * M + M / 2
          dots.push(
            <circle
              key={`d-${row}-${col}`}
              cx={cx}
              cy={cy}
              r={M * 0.42}
              fill={darkColor}
            />
          )
        }
      }

      // Finder patterns
      const finderPatterns: React.ReactNode[] = []
      const finderPositions = [
        { r: 0, c: 0 },
        { r: 0, c: cols - 7 },
        { r: cols - 7, c: 0 },
      ]

      for (const fp of finderPositions) {
        const ox = offset + fp.c * M
        const oy = offset + fp.r * M
        const outerSz = 7 * M
        const outerR = outerSz * 0.22

        finderPatterns.push(
          <g key={`fp-${fp.r}-${fp.c}`}>
            {/* Outer square */}
            <path d={roundedRect(ox, oy, outerSz, outerSz, outerR)} fill={darkColor} />
            {/* White border ring */}
            <path
              d={roundedRect(ox + M, oy + M, outerSz - 2 * M, outerSz - 2 * M, outerR * 0.5)}
              fill={lightColor}
            />
            {/* Inner dot */}
            <path
              d={roundedRect(ox + 2 * M, oy + 2 * M, 3 * M, 3 * M, (3 * M) * 0.3)}
              fill={darkColor}
            />
          </g>
        )
      }

      // Logo
      const effectiveLogoSize = logoSize ?? Math.round(viewSize * 0.22)
      const logoX = (viewSize - effectiveLogoSize) / 2
      const logoY = (viewSize - effectiveLogoSize) / 2
      const logoPad = effectiveLogoSize * 0.12
      const logoBgR = effectiveLogoSize * 0.22

      const logoEl = (
        <g key="logo">
          {/* White rounded background */}
          <path
            d={roundedRect(
              logoX - logoPad,
              logoY - logoPad,
              effectiveLogoSize + logoPad * 2,
              effectiveLogoSize + logoPad * 2,
              logoBgR
            )}
            fill={lightColor}
          />
          <image
            href={logoSrc}
            x={logoX}
            y={logoY}
            width={effectiveLogoSize}
            height={effectiveLogoSize}
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      )

      setSvgContent(
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          width={size}
          height={size}
          style={{ borderRadius: 16 }}
        >
          {/* Background */}
          <rect width={viewSize} height={viewSize} fill={lightColor} rx={M * 1.5} />
          {/* Data dots */}
          {dots}
          {/* Finder patterns */}
          {finderPatterns}
          {/* Logo */}
          {logoEl}
        </svg>
      )
    })
  }, [value, size, logoSrc, logoSize, darkColor, lightColor])

  if (!svgContent) {
    return (
      <div
        style={{ width: size, height: size, borderRadius: 16, background: lightColor }}
        aria-label="Loading QR code"
      />
    )
  }

  return <>{svgContent}</>
}