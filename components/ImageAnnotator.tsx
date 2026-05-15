'use client'

import { useRef, useState, useEffect } from 'react'

type Tool = 'pen' | 'circle' | 'arrow' | 'erase' | 'text'

interface TextAnnotation {
  id: string
  text: string
  x: number  // canvas pixel coordinates
  y: number
  color: string
  angle: number  // degrees
}

interface Props {
  file: File
  onSave: (blob: Blob) => void
  onCancel: () => void
}

const COLORS = [
  { value: '#FF3B30', label: 'אדום' },
  { value: '#000000', label: 'שחור' },
  { value: '#007AFF', label: 'כחול' },
  { value: '#34C759', label: 'ירוק' },
  { value: '#FFCC00', label: 'צהוב' },
]

const ANGLES = [0, 45, 90, -45]
const PEN_WIDTH = 4
const SHAPE_WIDTH = 3
const ERASE_WIDTH = 24
const TEXT_CANVAS_SIZE = 32  // font size in canvas pixels
const MAX_DIM = 2048

export function ImageAnnotator({ file, onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const snapshotRef = useRef<ImageData | null>(null)
  const historyRef = useRef<ImageData[]>([])
  const isDrawingRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; annX: number; annY: number } | null>(null)

  const [tool, setTool] = useState<Tool>('pen')
  const [ready, setReady] = useState(false)
  const [color, setColor] = useState('#FF3B30')
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([])
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null)
  const [pendingValue, setPendingValue] = useState('')
  const [pendingAngle, setPendingAngle] = useState(0)
  const [draggingId, setDraggingId] = useState<string | null>(null)

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

  // Canvas pixel coords → percentage of canvas display size (for overlay positioning)
  const toPercent = (cx: number, cy: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { left: '0%', top: '0%' }
    return {
      left: `${(cx / canvas.width) * 100}%`,
      top: `${(cy / canvas.height) * 100}%`,
    }
  }

  const ctx = () => canvasRef.current?.getContext('2d') ?? null

  const onStart = (pos: { x: number; y: number }) => {
    if (tool === 'text') {
      setPendingPos(pos)
      setPendingValue('')
      setPendingAngle(0)
      return
    }
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
      c.strokeStyle = color; c.lineWidth = PEN_WIDTH
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
      c.strokeStyle = color; c.lineWidth = SHAPE_WIDTH
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
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = SHAPE_WIDTH; c.lineCap = 'round'
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
    setTextAnnotations([])
  }

  const commitPendingText = () => {
    if (!pendingPos || !pendingValue.trim()) {
      setPendingPos(null); setPendingValue(''); return
    }
    setTextAnnotations(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      text: pendingValue.trim(),
      x: pendingPos.x,
      y: pendingPos.y,
      color,
      angle: pendingAngle,
    }])
    setPendingPos(null); setPendingValue(''); setPendingAngle(0)
  }

  const renderTextToCanvas = () => {
    const c = ctx(); const canvas = canvasRef.current
    if (!c || !canvas) return
    textAnnotations.forEach((ann) => {
      c.save()
      c.translate(ann.x, ann.y)
      c.rotate(ann.angle * Math.PI / 180)
      c.font = `bold ${TEXT_CANVAS_SIZE}px sans-serif`
      c.fillStyle = ann.color
      c.strokeStyle = 'rgba(0,0,0,0.6)'
      c.lineWidth = 3
      c.textBaseline = 'top'
      c.strokeText(ann.text, 0, 0)
      c.fillText(ann.text, 0, 0)
      c.restore()
    })
  }

  const handleSave = () => {
    renderTextToCanvas()
    canvasRef.current?.toBlob((blob) => { if (blob) onSave(blob) }, 'image/jpeg', 0.92)
  }

  const tools: { id: Tool; label: string }[] = [
    { id: 'pen', label: 'עט' },
    { id: 'circle', label: 'עיגול' },
    { id: 'arrow', label: 'חץ' },
    { id: 'text', label: 'טקסט' },
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
            נקה
          </button>
        </div>
      </div>

      {/* Color picker */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-800">
        <span className="text-gray-400 text-xs shrink-0">צבע:</span>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              style={{ backgroundColor: c.value }}
              className={`w-7 h-7 rounded-full transition-all ${
                color === c.value
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800 scale-110'
                  : 'opacity-70 hover:opacity-100'
              }`}
              aria-label={c.label}
            />
          ))}
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-950 p-2">
        {!ready && <p className="text-gray-400 text-sm">טוען...</p>}

        {/* Wrapper sized to canvas — allows % positioning of overlays */}
        <div className="relative" style={{ display: ready ? 'inline-block' : 'none', lineHeight: 0 }}>
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full touch-none block"
            style={{ cursor: tool === 'erase' ? 'cell' : tool === 'text' ? 'text' : 'crosshair' }}
            onMouseDown={(e) => { e.preventDefault(); onStart(getPos(e)) }}
            onMouseMove={(e) => { e.preventDefault(); onMove(getPos(e)) }}
            onMouseUp={(e) => { e.preventDefault(); onEnd() }}
            onMouseLeave={() => onEnd()}
            onTouchStart={(e) => { e.preventDefault(); onStart(getPos(e)) }}
            onTouchMove={(e) => { e.preventDefault(); onMove(getPos(e)) }}
            onTouchEnd={(e) => { e.preventDefault(); onEnd() }}
          />

          {/* Pending text input popup */}
          {pendingPos && (() => {
            const { left, top } = toPercent(pendingPos.x, pendingPos.y)
            return (
              <div
                className="absolute z-20 bg-gray-900 border border-gray-600 rounded-xl p-2 shadow-xl"
                style={{ left, top, minWidth: 200 }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <input
                  autoFocus
                  type="text"
                  value={pendingValue}
                  onChange={(e) => setPendingValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitPendingText()
                    if (e.key === 'Escape') { setPendingPos(null); setPendingValue('') }
                  }}
                  placeholder="הזן טקסט..."
                  className="w-full bg-gray-800 text-white text-sm px-2 py-1.5 rounded-lg outline-none mb-2"
                  dir="rtl"
                />
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-gray-400 text-xs ml-1">זווית:</span>
                  {ANGLES.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setPendingAngle(a)}
                      className={`text-xs px-2 py-1 rounded-lg ${
                        pendingAngle === a ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {a}°
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={commitPendingText}
                    className="flex-1 bg-orange-600 text-white text-xs py-1.5 rounded-lg">
                    הוסף
                  </button>
                  <button type="button" onClick={() => { setPendingPos(null); setPendingValue('') }}
                    className="flex-1 bg-gray-700 text-white text-xs py-1.5 rounded-lg">
                    ביטול
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Placed text annotation overlays */}
          {textAnnotations.map((ann) => {
            const { left, top } = toPercent(ann.x, ann.y)
            return (
              <div
                key={ann.id}
                className="absolute z-10 cursor-move"
                style={{
                  left,
                  top,
                  transform: `rotate(${ann.angle}deg)`,
                  transformOrigin: '0 0',
                  color: ann.color,
                  fontWeight: 'bold',
                  fontSize: 14,
                  fontFamily: 'sans-serif',
                  textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  const canvas = canvasRef.current!
                  const rect = canvas.getBoundingClientRect()
                  dragStartRef.current = {
                    mouseX: e.clientX,
                    mouseY: e.clientY,
                    annX: ann.x,
                    annY: ann.y,
                  }
                  setDraggingId(ann.id)
                }}
              >
                {ann.text}
                <button
                  type="button"
                  className="inline-block ml-1 text-xs leading-none text-red-400 hover:text-red-300 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setTextAnnotations(prev => prev.filter(a => a.id !== ann.id)) }}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Drag capture overlay — active while dragging a text annotation */}
      {draggingId && (
        <div
          className="fixed inset-0 z-30 cursor-move"
          onMouseMove={(e) => {
            if (!dragStartRef.current || !canvasRef.current) return
            const canvas = canvasRef.current
            const rect = canvas.getBoundingClientRect()
            const scaleX = canvas.width / rect.width
            const scaleY = canvas.height / rect.height
            const dx = (e.clientX - dragStartRef.current.mouseX) * scaleX
            const dy = (e.clientY - dragStartRef.current.mouseY) * scaleY
            setTextAnnotations(prev => prev.map(a =>
              a.id === draggingId
                ? { ...a, x: dragStartRef.current!.annX + dx, y: dragStartRef.current!.annY + dy }
                : a
            ))
          }}
          onMouseUp={() => { setDraggingId(null); dragStartRef.current = null }}
        />
      )}

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
