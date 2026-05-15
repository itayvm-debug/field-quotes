'use client'

import { useState } from 'react'
import { PREDEFINED_UNITS, type QuoteItemDraft } from '@/types'
import { calcItemTotal, formatCurrency } from '@/lib/calculations'
import { ItemImages } from './ItemImages'

interface Props {
  item: QuoteItemDraft
  onChange: (updates: Partial<QuoteItemDraft>) => void
  onRemove: () => void
  quoteId?: string
  userId?: string
  onAutoSave?: () => Promise<{ quoteId: string; dbId: string } | null>
}

const isCustomUnit = (unit: string) =>
  unit !== '' && !(PREDEFINED_UNITS as readonly string[]).includes(unit)

export function QuoteItemCard({ item, onChange, onRemove, quoteId, userId, onAutoSave }: Props) {
  const [autoSaving, setAutoSaving] = useState(false)
  const total = calcItemTotal(item.quantity, item.unit_price)
  const isCustom = isCustomUnit(item.unit)
  const selectValue = isCustom ? '__custom__' : item.unit

  const handleUnitSelect = (value: string) => {
    if (value === '__custom__') {
      onChange({ unit: '' })
    } else {
      onChange({ unit: value })
    }
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${item.is_optional ? 'border-amber-200' : 'border-gray-100'}`}>
      {/* Item number + remove */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-orange-600 bg-orange-50 rounded-full px-2.5 py-1">
            סעיף {item.item_number}
          </span>
          {item.is_optional && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
              אופציה
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-300 hover:text-red-400 text-lg leading-none px-1 transition-colors"
          aria-label="מחק סעיף"
        >
          ✕
        </button>
      </div>

      {/* Description */}
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">תיאור עבודה</label>
        <textarea
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="תאר את העבודה..."
        />
      </div>

      {/* Unit selector */}
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">יחידת מידה</label>
        <select
          value={selectValue}
          onChange={(e) => handleUnitSelect(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {PREDEFINED_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
          <option value="__custom__">אחר...</option>
        </select>
        {isCustom && (
          <input
            type="text"
            value={item.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="הזן יחידה מותאמת"
          />
        )}
      </div>

      {/* Quantity + Price row */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">כמות</label>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            min="0"
            step="0.001"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">מחיר יחידה (₪)</label>
          <input
            type="number"
            value={item.unit_price}
            onChange={(e) => onChange({ unit_price: e.target.value })}
            min="0"
            step="0.01"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">הערות (אופציונלי)</label>
        <input
          type="text"
          value={item.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="הערות לסעיף זה..."
        />
      </div>

      {/* Optional toggle */}
      <div className="mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={item.is_optional ?? false}
            onChange={(e) => onChange({ is_optional: e.target.checked })}
            className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
          />
          <span className="text-xs text-gray-500">סעיף אופציה (לא נכלל בסה״כ)</span>
        </label>
      </div>

      {/* Item total */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-sm text-gray-500">סה״כ סעיף</span>
        <div className="text-right">
          <span className={`font-bold text-lg ${item.is_optional ? 'text-gray-400' : 'text-gray-900'}`}>
            {formatCurrency(total)}
          </span>
          {item.is_optional && (
            <p className="text-xs text-amber-500 mt-0.5">לא נכלל בסה״כ</p>
          )}
        </div>
      </div>

      {/* Images */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        {item.dbId && quoteId && userId ? (
          <ItemImages itemDbId={item.dbId} quoteId={quoteId} userId={userId} />
        ) : onAutoSave ? (
          <button
            type="button"
            disabled={autoSaving}
            onClick={async () => {
              setAutoSaving(true)
              await onAutoSave()
              setAutoSaving(false)
            }}
            className="w-full text-xs text-orange-500 font-medium py-1.5 border border-dashed border-orange-200 rounded-xl active:bg-orange-50 disabled:opacity-50 transition-colors"
          >
            {autoSaving ? 'שומר...' : '+ הוסף תמונה (ישמור אוטומטית)'}
          </button>
        ) : (
          <p className="text-xs text-gray-400 text-center py-1">
            שמור את ההצעה כדי להוסיף תמונות
          </p>
        )}
      </div>
    </div>
  )
}
