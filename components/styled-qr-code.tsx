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

function roundedRectPath(
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
  const [svgEl, setSvgEl] = useState<React.ReactNode>(null)

  useEffect(() => {
    if (!value) return

    // Use QRCode.create to get the raw boolean matrix (no quiet zone padding)
    const qr = (QRCode as any).create(value, { errorCorrectionLevel: 'H' })
    const cols: number = qr.modules.size
    const data: Uint8Array = qr.modules.data

    const isDark = (row: number, col: number): boolean => {
      if (row < 0 || col < 0 || row >= cols || col >= cols) return false
      return data[row * cols + col] === 1
    }

    // Each module = M units in SVG viewBox; add padding around entire QR
    const M = 10
    const QUIET = 4 // modules of white space around QR
    const viewSize = (cols + QUIET * 2) * M
    const off = QUIET * M // offset for QR content

    const isInFinder = (row: number, col: number) => {
      return (
        (row < 7 && col < 7) ||           // top-left
        (row < 7 && col >= cols - 7) ||   // top-right
        (row >= cols - 7 && col < 7)       // bottom-left
      )
    }

    // --- Data dots ---
    const dots: React.ReactNode[] = []
    for (let row = 0; row < cols; row++) {
      for (let col = 0; col < cols; col++) {
        if (isInFinder(row, col)) continue
        if (!isDark(row, col)) continue
        const cx = off + col * M + M / 2
        const cy = off + row * M + M / 2
        dots.push(
          <circle key={`dot-${row}-${col}`} cx={cx} cy={cy} r={M * 0.44} fill={darkColor} />
        )
      }
    }

    // --- Finder patterns ---
    const finderPositions = [
      { r: 0, c: 0 },
      { r: 0, c: cols - 7 },
      { r: cols - 7, c: 0 },
    ]
    const finders = finderPositions.map(fp => {
      const ox = off + fp.c * M
      const oy = off + fp.r * M
      const outer = 7 * M
      const outerR = outer * 0.22
      return (
        <g key={`finder-${fp.r}-${fp.c}`}>
          {/* Outer filled rounded square */}
          <path d={roundedRectPath(ox, oy, outer, outer, outerR)} fill={darkColor} />
          {/* White ring (1 module border) */}
          <path
            d={roundedRectPath(ox + M, oy + M, outer - 2 * M, outer - 2 * M, outerR * 0.4)}
            fill={lightColor}
          />
          {/* Inner 3×3 dark dot */}
          <path
            d={roundedRectPath(ox + 2 * M, oy + 2 * M, 3 * M, 3 * M, M * 0.9)}
            fill={darkColor}
          />
        </g>
      )
    })

    // --- Logo ---
    const effLogoSize = logoSize ?? Math.round(viewSize * 0.2)
    const lx = (viewSize - effLogoSize) / 2
    const ly = (viewSize - effLogoSize) / 2
    const pad = effLogoSize * 0.14
    const bgR = effLogoSize * 0.24
    const logo = (
      <g key="logo">
        <path
          d={roundedRectPath(lx - pad, ly - pad, effLogoSize + pad * 2, effLogoSize + pad * 2, bgR)}
          fill={lightColor}
        />
        <image
          href={logoSrc}
          x={lx}
          y={ly}
          width={effLogoSize}
          height={effLogoSize}
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
    )

    setSvgEl(
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        width={size}
        height={size}
        style={{ borderRadius: 16, display: 'block' }}
      >
        <rect width={viewSize} height={viewSize} fill={lightColor} rx={M} />
        {dots}
        {finders}
        {logo}
      </svg>
    )
  }, [value, size, logoSrc, logoSize, darkColor, lightColor])

  return (
    <div style={{ width: size, height: size }}>
      {svgEl ?? (
        <div style={{ width: size, height: size, background: lightColor, borderRadius: 16 }} />
      )}
    </div>
  )
}