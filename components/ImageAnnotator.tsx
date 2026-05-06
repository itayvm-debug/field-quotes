'use client'

import { useRef, useState, useEffect } from 'react'

type Tool = 'pen' | 'circle' | 'arrow' | 'erase'

interface Props {
  file: File
  onSave: (blob: Blob) => void
  onCancel: () => void
}

const DRAW_COLOR = '#FF3B30'
const PEN_WIDTH = 4
const SHAPE_WIDTH = 3
const ERASE_WIDTH = 24
const MAX_DIM = 2048

export function ImageAnnotator({ file, onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const snapshotRef = useRef<ImageData | null>(null)
  const historyRef = useRef<ImageData[]>([])
  const isDrawingRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const [tool, setTool] = useState<Tool>('pen')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w > MAX_DIM) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM }
      if (h > MAX_DIM) { w = Math.round(w * MAX_DIM / h); h = MAX_DIM }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      historyRef.current = [ctx.getImageData(0, 0, w, h)]
      setReady(true)
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0] ?? e.changedTouches[0]
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy }
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }

  const ctx = () => canvasRef.current?.getContext('2d') ?? null

  const onStart = (pos: { x: number; y: number }) => {
    const c = ctx(); if (!c || !canvasRef.current) return
    isDrawingRef.current = true
    startPosRef.current = pos
    if (tool === 'circle' || tool === 'arrow') {
      snapshotRef.current = c.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
    if (tool === 'pen' || tool === 'erase') {
      c.beginPath(); c.moveTo(pos.x, pos.y)
    }
  }

  const onMove = (pos: { x: number; y: number }) => {
    if (!isDrawingRef.current) return
    const c = ctx(); const canvas = canvasRef.current
    if (!c || !canvas) return
    const { x: x0, y: y0 } = startPosRef.current
    const { x: x1, y: y1 } = pos

    if (tool === 'pen') {
      c.strokeStyle = DRAW_COLOR; c.lineWidth = PEN_WIDTH
      c.lineCap = 'round'; c.lineJoin = 'round'
      c.lineTo(x1, y1); c.stroke()
      c.beginPath(); c.moveTo(x1, y1)
    } else if (tool === 'erase') {
      c.strokeStyle = '#FFFFFF'; c.lineWidth = ERASE_WIDTH
      c.lineCap = 'round'; c.lineJoin = 'round'
      c.lineTo(x1, y1); c.stroke()
      c.beginPath(); c.moveTo(x1, y1)
    } else if (tool === 'circle' && snapshotRef.current) {
      c.putImageData(snapshotRef.current, 0, 0)
      c.strokeStyle = DRAW_COLOR; c.lineWidth = SHAPE_WIDTH
      c.beginPath()
      c.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, 2 * Math.PI)
      c.stroke()
    } else if (tool === 'arrow' && snapshotRef.current) {
      c.putImageData(snapshotRef.current, 0, 0)
      drawArrow(c, x0, y0, x1, y1)
    }
  }

  const onEnd = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const c = ctx(); const canvas = canvasRef.current
    if (!c || !canvas) return
    const snap = c.getImageData(0, 0, canvas.width, canvas.height)
    historyRef.current = [...historyRef.current.slice(-9), snap]
  }

  const drawArrow = (c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
    const angle = Math.atan2(y1 - y0, x1 - x0)
    const head = 20
    const spread = Math.PI / 6
    c.strokeStyle = DRAW_COLOR; c.fillStyle = DRAW_COLOR; c.lineWidth = SHAPE_WIDTH; c.lineCap = 'round'
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke()
    c.beginPath()
    c.moveTo(x1, y1)
    c.lineTo(x1 - head * Math.cos(angle - spread), y1 - head * Math.sin(angle - spread))
    c.lineTo(x1 - head * Math.cos(angle + spread), y1 - head * Math.sin(angle + spread))
    c.closePath(); c.fill()
  }

  const handleUndo = () => {
    const c = ctx(); const canvas = canvasRef.current
    if (!c || !canvas || historyRef.current.length <= 1) return
    historyRef.current = historyRef.current.slice(0, -1)
    c.putImageData(historyRef.current[historyRef.current.length - 1], 0, 0)
  }

  const handleReset = () => {
    const c = ctx(); const canvas = canvasRef.current
    if (!c || !canvas || historyRef.current.length === 0) return
    c.putImageData(historyRef.current[0], 0, 0)
    historyRef.current = [historyRef.current[0]]
  }

  const handleSave = () => {
    canvasRef.current?.toBlob((blob) => { if (blob) onSave(blob) }, 'image/jpeg', 0.92)
  }

  const tools: { id: Tool; label: string }[] = [
    { id: 'pen', label: 'עט' },
    { id: 'circle', label: 'עיגול' },
    { id: 'arrow', label: 'חץ' },
    { id: 'erase', label: 'מחק' },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 gap-2">
        <button type="button" onClick={onCancel}
          className="text-white text-sm px-3 py-1.5 rounded-lg bg-gray-700 active:bg-gray-600 shrink-0">
          ביטול
        </button>
        <div className="flex gap-1 overflow-x-auto">
          {tools.map((t) => (
            <button key={t.id} type="button" onClick={() => setTool(t.id)}
              className={`text-sm px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                tool === t.id ? 'bg-orange-500 text-white' : 'bg-gray-700 text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 shrink-0">
          <button type="button" onClick={handleUndo}
            className="text-white text-base px-2.5 py-1.5 rounded-lg bg-gray-700 active:bg-gray-600" title="בטל">
            ↩
          </button>
          <button type="button" onClick={handleReset}
            className="text-white text-xs px-2.5 py-1.5 rounded-lg bg-gray-700 active:bg-gray-600 whitespace-nowrap">
            נקה סימונים
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-950 p-2">
        {!ready && <p className="text-gray-400 text-sm">טוען...</p>}
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full touch-none"
          style={{ display: ready ? 'block' : 'none', cursor: tool === 'erase' ? 'cell' : 'crosshair' }}
          onMouseDown={(e) => { e.preventDefault(); onStart(getPos(e)) }}
          onMouseMove={(e) => { e.preventDefault(); onMove(getPos(e)) }}
          onMouseUp={(e) => { e.preventDefault(); onEnd() }}
          onMouseLeave={() => onEnd()}
          onTouchStart={(e) => { e.preventDefault(); onStart(getPos(e)) }}
          onTouchMove={(e) => { e.preventDefault(); onMove(getPos(e)) }}
          onTouchEnd={(e) => { e.preventDefault(); onEnd() }}
        />
      </div>

      {/* Save */}
      <div className="flex justify-center p-3 bg-gray-900">
        <button type="button" onClick={handleSave}
          className="bg-orange-600 text-white px-10 py-3 rounded-xl font-semibold text-base active:bg-orange-700">
          שמור ועלה
        </button>
      </div>
    </div>
  )
}
