import type { QuoteItemDraft } from '@/types'
import { calcSubtotal, calcVat, calcTotal } from '@/lib/calculations'
import { applyPriceAdjustments, parsePriceAdjustments } from '@/lib/priceAdjustments'

export interface RawQuote {
  id: string
  status: string
  payment_status: string
  paid_amount: number | string
  vat_percentage: number
  user_id: string
  quote_date: string
  client_name: string
  quote_number: string | null
  quote_items: Array<{ quantity: number; unit_price: number }>
  status_note?: string
  overpayment_note?: string  // migration 008
  price_adjustments?: unknown  // migration 013
}

export interface RawProfile {
  id: string
  full_name: string
  role: string
}

export interface UserStats {
  userId: string
  name: string
  role: string
  total: number
  draft: number
  sent: number
  accepted: number
  rejected: number
  archived: number
  totalAmount: number
  acceptedAmount: number
  paidTotal: number
  openBalance: number
  closedAdjustment: number
  collectionPct: number
  overpayCount: number
  overpayTotal: number
}

export interface AnalyticsKPI {
  totalCount: number
  acceptedCount: number
  paidTotal: number
  openBalance: number
  closedAdjustment: number
  overpayCount: number
  overpayTotal: number
}

export function quoteComputedTotal(q: RawQuote): number {
  const items: QuoteItemDraft[] = q.quote_items.map((i) => ({
    tempId: '', item_number: 0, description: '', unit: '', notes: '',
    quantity: String(i.quantity), unit_price: String(i.unit_price),
  }))
  const sub = calcSubtotal(items)
  const { adjustedTotal } = applyPriceAdjustments(sub, parsePriceAdjustments(q.price_adjustments))
  return calcTotal(adjustedTotal, calcVat(adjustedTotal, q.vat_percentage))
}

export function computeKPIs(quotes: RawQuote[]): AnalyticsKPI {
  const acceptedQuotes = quotes.filter((q) => q.status === 'accepted')
  return {
    totalCount: quotes.length,
    acceptedCount: acceptedQuotes.length,
    paidTotal: acceptedQuotes.reduce((s, q) => s + (parseFloat(String(q.paid_amount)) || 0), 0),
    openBalance: acceptedQuotes
      .filter((q) => q.payment_status === 'unpaid' || q.payment_status === 'partial')
      .reduce((s, q) => {
        const total = quoteComputedTotal(q)
        const paid = parseFloat(String(q.paid_amount)) || 0
        return s + Math.max(0, total - paid)
      }, 0),
    closedAdjustment: acceptedQuotes
      .filter((q) => q.payment_status === 'closed_partial')
      .reduce((s, q) => {
        const total = quoteComputedTotal(q)
        const paid = parseFloat(String(q.paid_amount)) || 0
        return s + Math.max(0, total - paid)
      }, 0),
    overpayCount: acceptedQuotes.filter((q) => {
      const total = quoteComputedTotal(q)
      const paid = parseFloat(String(q.paid_amount)) || 0
      return (q.overpayment_note ?? '') !== '' && paid > total
    }).length,
    overpayTotal: acceptedQuotes.reduce((s, q) => {
      const total = quoteComputedTotal(q)
      const paid = parseFloat(String(q.paid_amount)) || 0
      return (q.overpayment_note ?? '') !== '' && paid > total ? s + (paid - total) : s
    }, 0),
  }
}

export function computeUserStats(quotes: RawQuote[], profiles: RawProfile[]): UserStats[] {
  const profileMap = new Map<string, RawProfile>(profiles.map((p) => [p.id, p]))
  const statsMap = new Map<string, UserStats>()

  for (const q of quotes) {
    const uid = q.user_id ?? 'unknown'
    if (!statsMap.has(uid)) {
      const p = profileMap.get(uid)
      statsMap.set(uid, {
        userId: uid,
        name: p?.full_name ?? uid.slice(0, 8),
        role: p?.role ?? '—',
        total: 0, draft: 0, sent: 0, accepted: 0, rejected: 0, archived: 0,
        totalAmount: 0, acceptedAmount: 0, paidTotal: 0, openBalance: 0, closedAdjustment: 0, collectionPct: 0,
        overpayCount: 0, overpayTotal: 0,
      })
    }
    const row = statsMap.get(uid)!
    const t = quoteComputedTotal(q)
    row.total++
    row.totalAmount += t
    if (q.status === 'draft') row.draft++
    else if (q.status === 'sent') row.sent++
    else if (q.status === 'accepted') {
      row.accepted++
      row.acceptedAmount += t
      const paid = parseFloat(String(q.paid_amount)) || 0
      row.paidTotal += paid
      if (q.payment_status === 'unpaid' || q.payment_status === 'partial') {
        row.openBalance += Math.max(0, t - paid)
      } else if (q.payment_status === 'closed_partial') {
        row.closedAdjustment += Math.max(0, t - paid)
      }
      if ((q.overpayment_note ?? '') !== '' && paid > t) {
        row.overpayCount++
        row.overpayTotal += paid - t
      }
    } else if (q.status === 'rejected') row.rejected++
    else if (q.status === 'archived') row.archived++
  }

  for (const row of statsMap.values()) {
    row.collectionPct = row.acceptedAmount > 0 ? Math.round((row.paidTotal / row.acceptedAmount) * 100) : 0
  }

  return Array.from(statsMap.values()).sort((a, b) => b.total - a.total)
}

export function applyFilters(
  quotes: RawQuote[],
  opts: { userId?: string; fromDate?: string; toDate?: string; quoteStatus?: string; paymentStatus?: string }
): RawQuote[] {
  return quotes.filter((q) => {
    if (opts.userId && q.user_id !== opts.userId) return false
    if (opts.fromDate && q.quote_date < opts.fromDate) return false
    if (opts.toDate && q.quote_date > opts.toDate) return false
    if (opts.quoteStatus && q.status !== opts.quoteStatus) return false
    if (opts.paymentStatus) {
      if (q.status !== 'accepted') return false
      if ((q.payment_status ?? 'unpaid') !== opts.paymentStatus) return false
    }
    return true
  })
}
