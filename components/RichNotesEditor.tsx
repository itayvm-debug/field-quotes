'use client'

import { useState, useRef, useEffect } from 'react'
import { parseNotes, serializeNotes, type NoteParagraph } from '@/lib/notesFormat'

interface Props {
  value: string                      // JSON string (or legacy format)
  onChange: (value: string) => void
}

export function RichNotesEditor({ value, onChange }: Props) {
  const [paras, setParas] = useState<NoteParagraph[]>(() => parseNotes(value))
  const lastValue = useRef(value)
  const refs = useRef<(HTMLTextAreaElement | null)[]>([])

  // Re-sync when parent provides a new value (e.g., opening different quote)
  useEffect(() => {
    if (value !== lastValue.current) {
      setParas(parseNotes(value))
      lastValue.current = value
    }
  }, [value])

  const commit = (next: NoteParagraph[]) => {
    setParas(next)
    const serialized = serializeNotes(next)
    lastValue.current = serialized
    onChange(serialized)
  }

  const updateText = (idx: number, text: string) => {
    commit(paras.map((p, i) => (i === idx ? { ...p, text } : p)))
  }

  const toggleBold = (idx: number) => {
    commit(paras.map((p, i) => (i === idx ? { ...p, bold: !p.bold } : p)))
  }

  const addAfter = (idx: number) => {
    const next = [...paras]
    next.splice(idx + 1, 0, { text: '', bold: false })
    commit(next)
    setTimeout(() => refs.current[idx + 1]?.focus(), 0)
  }

  const removePara = (idx: number) => {
    if (paras.length === 1) {
      commit([{ text: '', bold: false }])
      return
    }
    const next = paras.filter((_, i) => i !== idx)
    commit(next)
    setTimeout(() => refs.current[Math.max(0, idx - 1)]?.focus(), 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, idx: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addAfter(idx)
      return
    }
    if (e.key === 'Backspace' && paras[idx].text === '' && paras.length > 1) {
      e.preventDefault()
      removePara(idx)
    }
  }

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">Shift+Enter = שורה, Enter = פסקה חדשה</span>
        <span className="text-xs text-gray-500">הערות (אופציונלי)</span>
      </div>

      <div className="border border-gray-200 rounded-xl bg-gray-50 focus-within:ring-2 focus-within:ring-orange-500 overflow-hidden">
        {paras.map((para, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-1.5 px-2 py-1.5 ${
              idx > 0 ? 'border-t border-gray-100' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => toggleBold(idx)}
              title={para.bold ? 'בטל הדגשה' : 'הדגש שורה זו'}
              className={`flex-shrink-0 font-bold text-xs w-6 h-6 mt-0.5 flex items-center justify-center border rounded transition-colors ${
                para.bold
                  ? 'bg-orange-100 border-orange-300 text-orange-700'
                  : 'border-gray-200 text-gray-300 hover:text-gray-500 hover:border-gray-300'
              }`}
            >
              B
            </button>

            <textarea
              ref={(el) => {
                refs.current[idx] = el
                if (el) autoGrow(el)
              }}
              value={para.text}
              dir="rtl"
              rows={1}
              onChange={(e) => {
                updateText(idx, e.target.value)
                autoGrow(e.target)
              }}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              placeholder={idx === 0 && paras.length === 1 ? 'הערות לסעיף זה...' : ''}
              className={`flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed py-0.5 ${
                para.bold ? 'font-bold text-gray-900' : 'text-gray-800'
              }`}
              style={{ minHeight: '24px', overflow: 'hidden', direction: 'rtl', unicodeBidi: 'isolate' }}
            />

            {paras.length > 1 && (
              <button
                type="button"
                onClick={() => removePara(idx)}
                aria-label="מחק שורה"
                className="flex-shrink-0 mt-1 text-gray-300 hover:text-red-400 text-sm leading-none px-0.5 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
