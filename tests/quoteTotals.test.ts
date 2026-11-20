import { describe, it, expect } from 'vitest'
import { quoteTotal } from '@/lib/quoteTotals'

describe('quoteTotal', () => {
  const items = [
    { quantity: 3, unit_price: 1000 },
    { quantity: '2', unit_price: '250.5', is_optional: true },
  ]

  it('sums required items only', () => {
    expect(quoteTotal({ vat_percentage: 0 }, items)).toBe(3000)
  })

  it('applies adjustments then VAT (DB numerics may arrive as strings)', () => {
    const q = {
      vat_percentage: '18',
      price_adjustments: [{ id: 'a', type: 'addition', name: 'x', valueType: 'percentage', percentage: 2.5 }],
    }
    // 3000 + 2.5% = 3075; VAT 18% = 553.50 → 3628.50
    expect(quoteTotal(q, items)).toBe(3628.5)
  })

  it('uses the manual total in overall mode', () => {
    expect(quoteTotal({ pricing_mode: 'overall', manual_total: '38500', vat_percentage: 0 }, items)).toBe(38500)
  })

  it('handles quotes with no items and missing fields', () => {
    expect(quoteTotal({}, [])).toBe(0)
  })
})
