import type { QuoteItemDraft } from '@/types'

export function calcItemTotal(quantity: string | number, unitPrice: string | number): number {
  const q = typeof quantity === 'string' ? parseFloat(quantity) || 0 : quantity
  const p = typeof unitPrice === 'string' ? parseFloat(unitPrice) || 0 : unitPrice
  return Math.round(q * p * 100) / 100
}

export function calcSubtotal(items: QuoteItemDraft[]): number {
  return items
    .filter((item) => !item.is_optional)
    .reduce((sum, item) => sum + calcItemTotal(item.quantity, item.unit_price), 0)
}

export function calcVat(subtotal: number, vatPct: number): number {
  return Math.round(subtotal * (vatPct / 100) * 100) / 100
}

export function calcTotal(subtotal: number, vatAmount: number): number {
  return Math.round((subtotal + vatAmount) * 100) / 100
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}
