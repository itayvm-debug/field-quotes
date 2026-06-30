'use client'

import { calcSubtotal, calcVat, calcTotal, formatCurrency } from '@/lib/calculations'
import type { QuoteItemDraft } from '@/types'

const VAT_RATE = 18

interface Props {
  items: QuoteItemDraft[]
  vatEnabled: boolean
  onVatToggle?: (enabled: boolean) => void
}

export function QuoteSummary({ items, vatEnabled, onVatToggle }: Props) {
  const subtotal = calcSubtotal(items)
  const vatAmount = calcVat(subtotal, vatEnabled ? VAT_RATE : 0)
  const total = calcTotal(subtotal, vatAmount)
  const optionalCount = items.filter((i) => i.is_optional).length

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h3 className="font-semibold text-gray-700 mb-4">סיכום כספי</h3>

      <div className="space-y-2.5">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">סה״כ לפני מע״מ</span>
          <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {onVatToggle && (
              <button
                type="button"
                role="switch"
                aria-checked={vatEnabled}
                onClick={() => onVatToggle(!vatEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  vatEnabled ? 'bg-orange-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    vatEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            )}
            <span className="text-sm text-gray-600 whitespace-nowrap">מע״מ {vatEnabled ? VAT_RATE : 0}%</span>
          </div>
          <span className="font-medium text-gray-900">
            {formatCurrency(vatAmount)}
          </span>
        </div>

        <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
          <span className="font-bold text-gray-900 text-lg">
            {vatEnabled ? 'סה״כ כולל מע״מ' : 'סה״כ'}
          </span>
          <span className="font-bold text-orange-600 text-xl">{formatCurrency(total)}</span>
        </div>
        {optionalCount > 0 && (
          <p className="text-xs text-amber-600 pt-2 border-t border-gray-100 mt-1">
            * לא כולל {optionalCount === 1 ? 'סעיף אופציה אחד' : `${optionalCount} סעיפי אופציה`}
          </p>
        )}
      </div>
    </div>
  )
}
