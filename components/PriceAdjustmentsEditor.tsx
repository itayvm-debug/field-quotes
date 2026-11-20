'use client'

import { useState } from 'react'
import type { PriceAdjustment } from '@/lib/priceAdjustments'

// Keeps the raw typed text locally so intermediate values like "2." or "0.0"
// survive re-renders; reports the parsed non-negative number upward.
function DecimalInput({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  const [text, setText] = useState(() => (value ? String(value) : ''))
  const parsed = parseFloat(text)
  const textValue = isNaN(parsed) || parsed < 0 ? 0 : parsed
  // Resync when the value changes from outside (e.g. % / ₪ toggle resets it)
  if ((value ?? 0) !== textValue) {
    setText(value ? String(value) : '')
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        const val = parseFloat(raw)
        onChange(isNaN(val) || val < 0 ? 0 : val)
      }}
      placeholder="0"
      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-left"
      style={{ direction: 'ltr' }}
    />
  )
}

const ADDITION_PRESETS = [
  'תוספת אילת',
  'תוספת עבודה בשטח מוגבל',
  'תוספת עבודה בשטח מאוכלס',
  'תוספת קבלן ראשי',
]

const DISCOUNT_PRESETS = [
  'הנחת מכרז',
  'הנחה כללית',
]

interface Props {
  adjustments: PriceAdjustment[]
  onChange: (adjustments: PriceAdjustment[]) => void
}

interface RowProps {
  adjustment: PriceAdjustment
  isFirst: boolean
  isLast: boolean
  onChange: (changes: Partial<PriceAdjustment>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

function AdjustmentRow({ adjustment, isFirst, isLast, onChange, onRemove, onMoveUp, onMoveDown }: RowProps) {
  const presets = adjustment.type === 'addition' ? ADDITION_PRESETS : DISCOUNT_PRESETS
  const isCustom = !presets.includes(adjustment.name)
  const valueType = adjustment.valueType ?? 'percentage'

  const handleTypeChange = (type: 'addition' | 'discount') => {
    const newPresets = type === 'addition' ? ADDITION_PRESETS : DISCOUNT_PRESETS
    onChange({ type, name: newPresets[0] })
  }

  const handlePresetChange = (value: string) => {
    onChange({ name: value === '__custom__' ? '' : value })
  }

  const handleValueTypeChange = (vt: 'percentage' | 'fixed') => {
    // Initialise the new value to 0 so the row passes parsePriceAdjustments
    // on reload even if the user saves before typing an amount.
    if (vt === 'fixed') {
      onChange({ valueType: 'fixed', percentage: undefined, fixedAmount: 0 })
    } else {
      onChange({ valueType: 'percentage', fixedAmount: undefined, percentage: 0 })
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2.5 bg-gray-50/50">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1.5">
          <button
            type="button"
            onClick={() => handleTypeChange('addition')}
            className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${
              adjustment.type === 'addition'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            תוספת +
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('discount')}
            className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${
              adjustment.type === 'discount'
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            הנחה -
          </button>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="w-7 h-7 flex items-center justify-center text-gray-400 disabled:opacity-25 hover:text-gray-600 text-sm"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="w-7 h-7 flex items-center justify-center text-gray-400 disabled:opacity-25 hover:text-gray-600 text-sm"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      <select
        value={isCustom ? '__custom__' : adjustment.name}
        onChange={(e) => handlePresetChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        {presets.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
        <option value="__custom__">אחר...</option>
      </select>

      {isCustom && (
        <input
          type="text"
          value={adjustment.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="שם ההתאמה..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      )}

      <div className="flex items-center gap-2">
        {/* % / ₪ toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
          <button
            type="button"
            onClick={() => handleValueTypeChange('percentage')}
            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              valueType === 'percentage'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-400 hover:bg-gray-50'
            }`}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => handleValueTypeChange('fixed')}
            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              valueType === 'fixed'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-400 hover:bg-gray-50'
            }`}
          >
            ₪
          </button>
        </div>

        {valueType === 'percentage' ? (
          <>
            <span className="text-xs text-gray-500 shrink-0">אחוז</span>
            <DecimalInput
              value={adjustment.percentage}
              onChange={(v) => onChange({ percentage: v })}
            />
            <span className="text-xs text-gray-400 shrink-0">%</span>
          </>
        ) : (
          <>
            <span className="text-xs text-gray-500 shrink-0">סכום</span>
            <DecimalInput
              value={adjustment.fixedAmount}
              onChange={(v) => onChange({ fixedAmount: v })}
            />
            <span className="text-xs text-gray-400 shrink-0">₪</span>
          </>
        )}
      </div>
    </div>
  )
}

export function PriceAdjustmentsEditor({ adjustments, onChange }: Props) {
  const addAdjustment = () => {
    onChange([
      ...adjustments,
      {
        id: crypto.randomUUID(),
        type: 'addition',
        name: ADDITION_PRESETS[0],
        valueType: 'percentage',
        percentage: 0,
      },
    ])
  }

  const updateAdjustment = (id: string, changes: Partial<PriceAdjustment>) => {
    onChange(adjustments.map((a) => (a.id === id ? { ...a, ...changes } : a)))
  }

  const removeAdjustment = (id: string) => {
    onChange(adjustments.filter((a) => a.id !== id))
  }

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = [...adjustments]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }

  const moveDown = (idx: number) => {
    if (idx === adjustments.length - 1) return
    const next = [...adjustments]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(next)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={addAdjustment}
          className="text-orange-600 text-sm font-semibold hover:text-orange-700 active:text-orange-800"
        >
          + הוסף הנחה/תוספת
        </button>
        <h3 className="font-semibold text-gray-700">הנחה/תוספת</h3>
      </div>
      {adjustments.length > 0 && (
        <p className="text-xs text-gray-400 mb-3 text-right">
          ההנחות והתוספות מחושבות לפי הסדר המוצג
        </p>
      )}
      <div className="space-y-3">
        {adjustments.map((adj, idx) => (
          <AdjustmentRow
            key={adj.id}
            adjustment={adj}
            isFirst={idx === 0}
            isLast={idx === adjustments.length - 1}
            onChange={(changes) => updateAdjustment(adj.id, changes)}
            onRemove={() => removeAdjustment(adj.id)}
            onMoveUp={() => moveUp(idx)}
            onMoveDown={() => moveDown(idx)}
          />
        ))}
      </div>
    </div>
  )
}
