'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface Props {
  onSave: (dataUrl: string) => void
  disabled?: boolean
}

export function SignaturePad({ onSave, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isEmpty, setIsEmpty] = useState(true)
  const isDrawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  // Init canvas with device pixel ratio for crisp rendering on retina
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#1A1A1A'
    ctx.fillStyle = '#1A1A1A'
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const getCtx = () => canvasRef.current?.getContext('2d') ?? null

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const ctx = getCtx()
    if (!ctx) return
    const pt = getPoint(e)
    // Draw a dot on tap/click with no drag
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    lastPoint.current = pt
    isDrawing.current = true
    setIsEmpty(false)
  }, [disabled])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || disabled) return
    const ctx = getCtx()
    if (!ctx || !lastPoint.current) return
    const pt = getPoint(e)
    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    lastPoint.current = pt
  }, [disabled])

  const handlePointerUp = useCallback(() => {
    isDrawing.current = false
    lastPoint.current = null
  }, [])

  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas || isEmpty) return
    onSave(canvas.toDataURL('image/png'))
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-white cursor-crosshair"
        style={{ height: 140, touchAction: 'none', display: 'block' }}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleClear}
          disabled={isEmpty || disabled}
          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 active:bg-gray-50 disabled:opacity-40"
        >
          נקה
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isEmpty || disabled}
          className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-semibold active:bg-orange-700 disabled:opacity-40"
        >
          שמור חתימה
        </button>
      </div>
    </div>
  )
}
