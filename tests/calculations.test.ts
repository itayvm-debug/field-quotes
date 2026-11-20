import { describe, it, expect } from 'vitest'
import { calcItemTotal, calcSubtotal, calcVat, calcTotal, getQuoteBaseTotal, formatDate } from '@/lib/calculations'
import type { QuoteItemDraft } from '@/types'

const item = (quantity: string, unit_price: string, is_optional = false): QuoteItemDraft => ({
  tempId: Math.random().toString(36),
  item_number: 1,
  description: 'x',
  unit: 'יח׳',
  quantity,
  unit_price,
  notes: '',
  is_optional,
})

describe('calcItemTotal', () => {
  it('multiplies and rounds to agorot', () => {
    expect(calcItemTotal('3', '1000')).toBe(3000)
    expect(calcItemTotal('2', '250.5')).toBe(501)
    expect(calcItemTotal('1.333', '7.5')).toBe(10) // 9.9975 → 10.00
  })
  it('treats empty / invalid input as 0', () => {
    expect(calcItemTotal('', '100')).toBe(0)
    expect(calcItemTotal('abc', '100')).toBe(0)
    expect(calcItemTotal(2, 3.5)).toBe(7)
  })
})

describe('calcSubtotal', () => {
  it('excludes optional items', () => {
    expect(calcSubtotal([item('3', '1000'), item('2', '250.5', true)])).toBe(3000)
  })
  it('sums required items', () => {
    expect(calcSubtotal([item('1', '7500'), item('1', '1750'), item('2', '0.25')])).toBe(9250.5)
  })
  it('is 0 for no items', () => {
    expect(calcSubtotal([])).toBe(0)
  })
})

describe('VAT and total', () => {
  it('computes 18% VAT rounded to agorot', () => {
    expect(calcVat(1000, 18)).toBe(180)
    expect(calcVat(1234.56, 18)).toBe(222.22)
    expect(calcVat(1000, 0)).toBe(0)
  })
  it('adds subtotal and VAT', () => {
    expect(calcTotal(1234.56, 222.22)).toBe(1456.78)
  })
})

describe('getQuoteBaseTotal (pricing_mode)', () => {
  const items = [item('3', '1000'), item('1', '500', true)]
  it('items mode sums required items', () => {
    expect(getQuoteBaseTotal(items, 'items', 99999)).toBe(3000)
  })
  it('defaults to items mode when mode is missing (old quotes)', () => {
    expect(getQuoteBaseTotal(items, undefined, null)).toBe(3000)
    expect(getQuoteBaseTotal(items, null, null)).toBe(3000)
  })
  it('overall mode uses the manual total and ignores items', () => {
    expect(getQuoteBaseTotal(items, 'overall', 12500)).toBe(12500)
  })
  it('overall mode without a manual total is 0', () => {
    expect(getQuoteBaseTotal(items, 'overall', null)).toBe(0)
    expect(getQuoteBaseTotal(items, 'overall', NaN)).toBe(0)
  })
})

describe('formatDate', () => {
  it('formats YYYY-MM-DD as DD/MM/YYYY', () => {
    expect(formatDate('2026-11-20')).toBe('20/11/2026')
    expect(formatDate('')).toBe('')
  })
})
