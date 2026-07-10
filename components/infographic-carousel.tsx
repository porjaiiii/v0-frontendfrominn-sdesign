'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'

export type InfographicSlide = { src: string; alt: string }

const MAX_ZOOM = 4

// Swipeable infographic catalog, tuned for mobile + elder-friendliness:
//  • ALL images stay mounted, so switching is an instant crossfade (no reload/
//    decode delay), and looping 10→1 looks the same as any other step
//  • each slide sizes to its OWN aspect ratio and is never stretched
//  • tap a slide to open a fullscreen viewer; there, PINCH with two fingers to
//    zoom (the app disables native pinch-zoom) and drag with one finger to pan
//  • large tap targets, position counter, tappable dots, and a hint
//  • arrows fade out after a moment of no interaction, and reappear on any touch
export function InfographicCarousel({ slides }: { slides: InfographicSlide[] }) {
  const [index, setIndex] = useState(0)
  const [showArrows, setShowArrows] = useState(true)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  // Fullscreen viewer pinch/pan transform.
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [gesturing, setGesturing] = useState(false)

  const count = slides.length
  const touchStartX = useRef<number | null>(null)
  const touchDeltaX = useRef(0)
  const justSwiped = useRef(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Active pinch/pan gesture state (kept in a ref so moves don't re-render it).
  const gesture = useRef({
    mode: 'none' as 'none' | 'pinch' | 'pan',
    startDist: 0,
    startScale: 1,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
  })

  // Reveal the arrows, then fade them again after a spell of inactivity.
  const wakeArrows = useCallback(() => {
    setShowArrows(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setShowArrows(false), 2500)
  }, [])

  useEffect(() => {
    wakeArrows()
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [wakeArrows])

  // Lock background scroll while the fullscreen viewer is open.
  useEffect(() => {
    if (!lightboxOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [lightboxOpen])

  const resetZoom = useCallback(() => {
    setScale(1)
    setTx(0)
    setTy(0)
    gesture.current.mode = 'none'
  }, [])

  // Reset zoom whenever the viewed slide changes.
  useEffect(() => {
    resetZoom()
  }, [index, lightboxOpen, resetZoom])

  const go = useCallback(
    (dir: number) => {
      wakeArrows()
      setIndex((i) => (i + dir + count) % count)
    },
    [count, wakeArrows]
  )

  const jumpTo = useCallback(
    (i: number) => {
      wakeArrows()
      setIndex(i)
    },
    [wakeArrows]
  )

  const openLightbox = () => {
    // Ignore the click the browser fires right after a swipe.
    if (justSwiped.current) return
    resetZoom()
    setLightboxOpen(true)
  }

  // ---- Carousel swipe (single finger, horizontal) ----
  const onTouchStart = (e: React.TouchEvent) => {
    wakeArrows()
    touchStartX.current = e.touches[0].clientX
    touchDeltaX.current = 0
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current !== null) {
      touchDeltaX.current = e.touches[0].clientX - touchStartX.current
    }
  }
  const onTouchEnd = () => {
    const SWIPE_THRESHOLD = 40 // px — forgiving for less precise swipes
    if (touchDeltaX.current > SWIPE_THRESHOLD) go(-1)
    else if (touchDeltaX.current < -SWIPE_THRESHOLD) go(1)
    if (Math.abs(touchDeltaX.current) > SWIPE_THRESHOLD) {
      justSwiped.current = true
      setTimeout(() => {
        justSwiped.current = false
      }, 350)
    }
    touchStartX.current = null
    touchDeltaX.current = 0
  }

  // ---- Fullscreen viewer pinch-to-zoom + one-finger pan ----
  const twoFingerDist = (touches: React.TouchList) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)

  const onViewerTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      gesture.current.mode = 'pinch'
      gesture.current.startDist = twoFingerDist(e.touches)
      gesture.current.startScale = scale
      setGesturing(true)
    } else if (e.touches.length === 1 && scale > 1) {
      gesture.current.mode = 'pan'
      gesture.current.startX = e.touches[0].clientX
      gesture.current.startY = e.touches[0].clientY
      gesture.current.startTx = tx
      gesture.current.startTy = ty
      setGesturing(true)
    } else {
      gesture.current.mode = 'none'
    }
  }

  const onViewerTouchMove = (e: React.TouchEvent) => {
    if (gesture.current.mode === 'pinch' && e.touches.length === 2) {
      const next = Math.min(
        MAX_ZOOM,
        Math.max(1, gesture.current.startScale * (twoFingerDist(e.touches) / gesture.current.startDist))
      )
      setScale(next)
      if (next === 1) {
        setTx(0)
        setTy(0)
      }
    } else if (gesture.current.mode === 'pan' && e.touches.length === 1) {
      setTx(gesture.current.startTx + (e.touches[0].clientX - gesture.current.startX))
      setTy(gesture.current.startTy + (e.touches[0].clientY - gesture.current.startY))
    }
  }

  const onViewerTouchEnd = (e: React.TouchEvent) => {
    if (scale <= 1) {
      setTx(0)
      setTy(0)
    }
    if (e.touches.length === 0) {
      gesture.current.mode = 'none'
      setGesturing(false)
    }
  }

  const arrowBase =
    'absolute top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 shadow-md flex items-center justify-center text-[#154212] active:scale-95 transition-all duration-500'

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-[#cdeccb] bg-[#f3faf1] shadow-sm"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Every slide stays mounted. The active one is in normal flow (so the
            box sizes to its own height); the rest overlay it, faded out. This
            makes switching an instant crossfade with no image reload. */}
        {slides.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={encodeURI(s.src)}
            alt={s.alt}
            draggable={false}
            aria-hidden={i !== index}
            onClick={i === index ? openLightbox : undefined}
            className={cn(
              'w-full h-auto select-none transition-opacity duration-300 ease-out',
              i === index
                ? 'relative opacity-100 cursor-zoom-in'
                : 'absolute top-0 left-0 opacity-0 pointer-events-none'
            )}
          />
        ))}

        {/* Tap-to-open hint badge — fades with the arrows when idle */}
        <div
          className={cn(
            'absolute top-2 left-2 flex items-center gap-1 rounded-full bg-[#154212]/80 px-2.5 py-1 text-xs font-medium text-white pointer-events-none transition-all duration-500',
            showArrows ? 'opacity-100' : 'opacity-0'
          )}
        >
          <ZoomIn className="w-3.5 h-3.5" />
          แตะเพื่อขยาย
        </div>

        {/* Prev / Next arrows — fade out when idle, reappear on any touch */}
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="รูปก่อนหน้า"
          className={cn(arrowBase, 'left-2', showArrows ? 'opacity-100' : 'opacity-0')}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="รูปถัดไป"
          className={cn(arrowBase, 'right-2', showArrows ? 'opacity-100' : 'opacity-0')}
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Position counter */}
        <div className="absolute bottom-2 right-3 rounded-full bg-[#154212]/80 px-2.5 py-0.5 text-xs font-semibold text-white">
          {index + 1} / {count}
        </div>
      </div>

      {/* Dots — also tappable to jump directly */}
      <div className="flex justify-center gap-2 mt-3">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => jumpTo(i)}
            aria-label={`ไปยังรูปที่ ${i + 1}`}
            aria-current={i === index}
            className={cn(
              'h-2.5 rounded-full transition-all',
              i === index ? 'w-6 bg-[#154212]' : 'w-2.5 bg-[#a9d3a2]'
            )}
          />
        ))}
      </div>

      {/* Hint */}
      <p className="text-center text-sm text-[#5a7a5a] mt-2">
        แตะรูปเพื่อขยายดูใกล้ ๆ · ปัดซ้าย–ขวาเพื่อดูรูปถัดไป
      </p>

      {/* Fullscreen viewer with two-finger pinch-to-zoom */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/90">
          {/* Top bar with a big, obvious close button */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-white/90">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="ปิด"
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white active:scale-95 transition-transform"
            >
              <X className="w-5 h-5" />
              ปิด
            </button>
          </div>

          {/* Pinch/pan area. touch-action:none lets us fully own the gesture
              (the browser's own pinch-zoom is disabled app-wide anyway).
              Tapping the dark area closes the viewer. */}
          <div
            className="flex-1 overflow-hidden flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={encodeURI(slides[index].src)}
              alt={slides[index].alt}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={onViewerTouchStart}
              onTouchMove={onViewerTouchMove}
              onTouchEnd={onViewerTouchEnd}
              style={{
                transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                transition: gesturing ? 'none' : 'transform 150ms ease-out',
                touchAction: 'none',
              }}
              className="max-w-full max-h-full object-contain select-none"
            />
          </div>

          <p className="text-center text-sm text-white/80 py-3">
            ใช้สองนิ้วเพื่อซูมเข้า–ออก · กด “ปิด” เพื่อกลับ
          </p>
        </div>
      )}
    </div>
  )
}
