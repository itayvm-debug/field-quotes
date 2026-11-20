import { getQuoteBaseTotal, calcVat, calcTotal } from '@/lib/calculations'
import { applyPriceAdjustments, parsePriceAdjustments } from '@/lib/priceAdjustments'
import type { QuoteItemDraft } from '@/types'

export interface TotalsQuote {
  pricing_mode?: string | null
  manual_total?: number | string | null
  price_adjustments?: unknown
  vat_percentage?: number | string | null
}
export interface TotalsItem {
  quantity: number | string
  unit_price: number | string
  is_optional?: boolean | null
}

// Quote total incl. adjustments and VAT, excluding optional items —
// same formula as the dashboard cards and the PDF.
export function quoteTotal(quote: TotalsQuote, items: TotalsItem[]): number {
  const drafts: QuoteItemDraft[] = items.map((i) => ({
    tempId: '', item_number: 0, description: '', unit: '', notes: '',
    quantity: String(i.quantity), unit_price: String(i.unit_price), is_optional: i.is_optional ?? false,
  }))
  const mode = quote.pricing_mode === 'overall' ? 'overall' : 'items'
  const manual = quote.manual_total == null ? null : Number(quote.manual_total)
  const base = getQuoteBaseTotal(drafts, mode, manual)
  const { adjustedTotal } = applyPriceAdjustments(base, parsePriceAdjustments(quote.price_adjustments))
  const vat = calcVat(adjustedTotal, Number(quote.vat_percentage ?? 0))
  return calcTotal(adjustedTotal, vat)
}
