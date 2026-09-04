'use client'

import { useState } from 'react'
import type { QuoteItemDraft } from '@/types'
import { calcItemTotal, formatCurrency } from '@/lib/calculations'

interface Props {
  items: QuoteItemDraft[]
  /** Returns null on success, or an error string on failure. */
  onSave: (reorderedItems: QuoteItemDraft[]) => Promise<string | null>
  onClose: () => void
}

export function ReorderItemsModal({ items, onSave, onClose }: Props) {
  const [order, setOrder] = useState<QuoteItemDraft[]>(() => [...items])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const moveUp = (idx: number) => {
    if (idx === 0 || saving) return
    setSaveError(null)
    setOrder((prev) => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const moveDown = (idx: number) => {
    if (idx === order.length - 1 || saving) return
    setSaveError(null)
    setOrder((prev) => {
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    if (saving) { e.preventDefault(); return }
    setDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (saving) return
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(idx)
  }

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (saving || dragIndex === null || dragIndex === idx) return
    setSaveError(null)
    setOrder((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(idx, 0, moved)
      return next
    })
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setSaveError(null)

    const renumbered = order.map((item, idx) => ({ ...item, item_number: idx + 1 }))
    const err = await onSave(renumbered)

    if (err) {
      setSaveError(err)
      setSaving(false)
    } else {
      // Success — parent already updated state; close modal
      onClose()
    }
  }

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col" dir="rtl">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1 disabled:opacity-40"
          >
            ✕
          </button>
          <h2 className="font-bold text-gray-800 text-base">סידור סעיפים</h2>
          <div className="w-8" />
        </div>

        {/* Instruction */}
        <p className="text-xs text-gray-400 text-center px-4 pt-3 pb-1 shrink-0">
          גרור שורה, או השתמש בכפתורי ▲ ▼
        </p>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-4 py-2 space-y-2">
          {order.map((item, idx) => {
            const isDragging = dragIndex === idx
            const isTarget  = dragOverIndex === idx && dragIndex !== null && dragIndex !== idx
            return (
              <div
                key={item.tempId}
                draggable={!saving}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e)  => handleDragOver(e, idx)}
                onDrop={(e)      => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={[
                  'flex items-center gap-2 rounded-xl px-3 py-2.5 select-none transition-colors',
                  saving      ? 'opacity-60' : '',
                  isDragging  ? 'opacity-40 bg-orange-50 border border-orange-200' : '',
                  isTarget    ? 'bg-orange-50 border-2 border-orange-300' : '',
                  !isDragging && !isTarget ? 'bg-gray-50 border border-gray-100' : '',
                ].join(' ')}
              >
                {/* Drag handle */}
                <span className={`text-gray-300 text-base shrink-0 select-none ${saving ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}>
                  ⠿
                </span>

                {/* Item number badge */}
                <span className="text-xs font-bold text-orange-600 bg-orange-50 rounded-full px-2 py-0.5 shrink-0 min-w-[1.75rem] text-center border border-orange-100">
                  {idx + 1}
                </span>

                {/* Description + total */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate leading-tight">
                    {item.description || '(ללא תיאור)'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">
                      {formatCurrency(calcItemTotal(item.quantity, item.unit_price))}
                    </span>
                    {item.is_optional && (
                      <span className="text-xs text-amber-600 bg-amber-50 rounded-full px-1.5 py-0.5">
                        אופציה
                      </span>
                    )}
                  </div>
                </div>

                {/* Up / Down */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0 || saving}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 disabled:opacity-25 active:bg-gray-200 rounded-lg text-xs"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(idx)}
                    disabled={idx === order.length - 1 || saving}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 disabled:opacity-25 active:bg-gray-200 rounded-lg text-xs"
                  >
                    ▼
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Error */}
        {saveError && (
          <p className="text-xs text-red-600 text-center px-4 pt-2 pb-0 shrink-0">
            {saveError}
          </p>
        )}

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-100 grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="py-3 border border-gray-200 rounded-xl text-gray-600 font-medium text-sm bg-white active:bg-gray-50 disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="py-3 bg-orange-600 text-white rounded-xl font-semibold text-sm active:bg-orange-700 disabled:opacity-60 transition-colors"
          >
            {saving ? 'שומר...' : 'שמור סדר'}
          </button>
        </div>
      </div>
    </div>
  )
}
