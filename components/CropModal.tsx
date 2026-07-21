'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Props {
  file: File
  aspectRatio: number          // width / height, e.g. 16/9 or 1
  defaultFit?: 'cover' | 'contain'
  onConfirm: (blob: Blob, fit: 'cover' | 'contain') => void
  onCancel: () => void
}

// Display frame size (CSS px = canvas pixels for the preview)
const FRAME_W = 320
// Output image resolution
const OUTPUT_W = 1280

function computeMinScale(
  iw: number, ih: number, fw: number, fh: number, fit: 'cover' | 'contain'
): number {
  return fit === 'cover'
    ? Math.max(fw / iw, fh / ih)
    : Math.min(fw / iw, fh / ih)
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function clampOffset(
  ox: number, oy: number, scale: number,
  iw: number, ih: number, fw: number, fh: number,
  fit: 'cover' | 'contain'
): { x: number; y: number } {
  if (fit === 'contain') return { x: 0, y: 0 }
  const maxX = Math.max(0, (iw * scale - fw) / 2)
  const maxY = Math.max(0, (ih * scale - fh) / 2)
  return { x: clamp(ox, -maxX, maxX), y: clamp(oy, -maxY, maxY) }
}

export function CropModal({ file, aspectRatio, defaultFit = 'cover', onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const scaleRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const fitRef = useRef<'cover' | 'contain'>(defaultFit)
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  const [fit, setFit] = useState<'cover' | 'contain'>(defaultFit)
  const [ready, setReady] = useState(false)
  const [processing, setProcessing] = useState(false)

  const frameH = Math.round(FRAME_W / aspectRatio)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, FRAME_W, frameH)
    ctx.fillStyle = '#111111'
    ctx.fillRect(0, 0, FRAME_W, frameH)
    const s = scaleRef.current
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const x = (FRAME_W - iw * s) / 2 + offsetRef.current.x
    const y = (frameH - ih * s) / 2 + offsetRef.current.y
    ctx.drawImage(img, x, y, iw * s, ih * s)
  }, [frameH])

  // Load image once on mount
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const ms = computeMinScale(img.naturalWidth, img.naturalHeight, FRAME_W, frameH, fitRef.current)
      scaleRef.current = ms
      offsetRef.current = { x: 0, y: 0 }
      setReady(true)
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  useEffect(() => {
    if (ready) draw()
  }, [ready, draw])

  // Non-passive wheel listener so e.preventDefault() works
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      applyZoom(e.deltaY < 0 ? 1.12 : 0.89)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const applyZoom = useCallback((factor: number) => {
    const img = imgRef.current
    if (!img) return
    const ms = computeMinScale(img.naturalWidth, img.naturalHeight, FRAME_W, frameH, fitRef.current)
    const newScale = clamp(scaleRef.current * factor, ms, ms * 8)
    scaleRef.current = newScale
    offsetRef.current = clampOffset(
      offsetRef.current.x, offsetRef.current.y, newScale,
      img.naturalWidth, img.naturalHeight, FRAME_W, frameH, fitRef.current
    )
    draw()
  }, [frameH, draw])

  const setFitMode = useCallback((newFit: 'cover' | 'contain') => {
    const img = imgRef.current
    if (!img) return
    fitRef.current = newFit
    setFit(newFit)
    const ms = computeMinScale(img.naturalWidth, img.naturalHeight, FRAME_W, frameH, newFit)
    scaleRef.current = ms
    offsetRef.current = { x: 0, y: 0 }
    draw()
  }, [frameH, draw])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (fitRef.current === 'contain') return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const img = imgRef.current
    if (!img) return
    const ox = dragRef.current.ox + e.clientX - dragRef.current.sx
    const oy = dragRef.current.oy + e.clientY - dragRef.current.sy
    offsetRef.current = clampOffset(ox, oy, scaleRef.current, img.naturalWidth, img.naturalHeight, FRAME_W, frameH, fitRef.current)
    draw()
  }, [frameH, draw])

  const onPointerUp = useCallback(() => { dragRef.current = null }, [])

  const handleConfirm = useCallback(() => {
    const img = imgRef.current
    if (!img || processing) return
    setProcessing(true)

    const outputH = Math.round(OUTPUT_W / aspectRatio)
    const offscreen = document.createElement('canvas')
    offscreen.width = OUTPUT_W
    offscreen.height = outputH
    const ctx = offscreen.getContext('2d')!

    const ratio = OUTPUT_W / FRAME_W
    const s = scaleRef.current * ratio
    const x = (OUTPUT_W - img.naturalWidth * s) / 2 + offsetRef.current.x * ratio
    const y = (outputH - img.naturalHeight * s) / 2 + offsetRef.current.y * ratio

    if (fitRef.current === 'contain') {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, OUTPUT_W, outputH)
    }
    ctx.drawImage(img, x, y, img.naturalWidth * s, img.naturalHeight * s)

    offscreen.toBlob((blob) => {
      setProcessing(false)
      if (blob) onConfirm(blob, fitRef.current)
    }, 'image/jpeg', 0.92)
  }, [aspectRatio, onConfirm, processing])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none" dir="rtl">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
        <button type="button" onClick={onCancel}
          className="text-white text-sm px-3 py-1.5 rounded-lg bg-gray-700 active:bg-gray-600 shrink-0">
          ביטול
        </button>
        <span className="text-white font-semibold text-sm">חיתוך תמונה</span>
        <button type="button" onClick={handleConfirm} disabled={!ready || processing}
          className="bg-orange-600 text-white text-sm px-4 py-1.5 rounded-lg font-semibold active:bg-orange-700 disabled:opacity-50 shrink-0">
          {processing ? 'מעבד...' : 'אשר חיתוך'}
        </button>
      </div>

      {/* Fit selector */}
      <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800">
        <span className="text-gray-400 text-xs shrink-0">תצוגה:</span>
        <button type="button" onClick={() => setFitMode('cover')}
          className={`text-sm px-3 py-1 rounded-lg font-medium transition-colors ${
            fit === 'cover' ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'
          }`}>
          מילוי מסגרת
        </button>
        <button type="button" onClick={() => setFitMode('contain')}
          className={`text-sm px-3 py-1 rounded-lg font-medium transition-colors ${
            fit === 'contain' ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'
          }`}>
          הצג הכל
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-950 gap-4 px-4">
        {!ready && <p className="text-gray-400 text-sm">טוען...</p>}

        {ready && (
          <>
            {/* Crop frame with orange border */}
            <div className="relative" style={{ width: FRAME_W, height: frameH, maxWidth: '100%' }}>
              <canvas
                ref={canvasRef}
                width={FRAME_W}
                height={frameH}
                className="block max-w-full"
                style={{
                  width: FRAME_W,
                  height: frameH,
                  cursor: fit === 'cover' ? 'grab' : 'default',
                  touchAction: 'none',
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              />
              <div className="absolute inset-0 border-2 border-orange-500 pointer-events-none rounded-sm" />
            </div>

            {/* Zoom controls (cover only) */}
            {fit === 'cover' && (
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => applyZoom(0.85)}
                  className="w-10 h-10 bg-gray-700 text-white rounded-full text-2xl flex items-center justify-center active:bg-gray-600 font-light">
                  −
                </button>
                <span className="text-gray-500 text-xs">זום</span>
                <button type="button" onClick={() => applyZoom(1.18)}
                  className="w-10 h-10 bg-gray-700 text-white rounded-full text-2xl flex items-center justify-center active:bg-gray-600 font-light">
                  +
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Hint bar */}
      <div className="text-center py-3 bg-gray-900 text-xs text-gray-500 px-4">
        {fit === 'cover'
          ? 'גרור להזזה • +/− לשינוי גודל'
          : 'כל התמונה תוצג עם שוליים לבנים ב-PDF'}
      </div>

    </div>
  )
}
