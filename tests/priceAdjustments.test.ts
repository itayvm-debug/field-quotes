import { describe, it, expect } from 'vitest'
import {
  applyPriceAdjustments, parsePriceAdjustments, adjustmentDisplayLabel, roundMoney,
  type PriceAdjustment,
} from '@/lib/priceAdjustments'

const pct = (type: 'addition' | 'discount', percentage: number, name = 'x'): PriceAdjustment =>
  ({ id: Math.random().toString(36), type, name, valueType: 'percentage', percentage })
const fixed = (type: 'addition' | 'discount', fixedAmount: number, name = 'x'): PriceAdjustment =>
  ({ id: Math.random().toString(36), type, name, valueType: 'fixed', fixedAmount })

describe('applyPriceAdjustments', () => {
  it('returns the base when there are no adjustments', () => {
    const r = applyPriceAdjustments(3501, [])
    expect(r.adjustedTotal).toBe(3501)
    expect(r.adjustments).toEqual([])
  })

  it('applies a decimal percentage with agorot rounding (2.5% of 3,501 = 87.53)', () => {
    const r = applyPriceAdjustments(3501, [pct('addition', 2.5)])
    expect(r.adjustments[0].amount).toBe(87.53)
    expect(r.adjustedTotal).toBe(3588.53)
  })

  it('applies adjustments sequentially on the running total', () => {
    // +10% → 1100, then -10% of 1100 = 110 → 990
    const r = applyPriceAdjustments(1000, [pct('addition', 10), pct('discount', 10)])
    expect(r.adjustments.map((a) => a.amount)).toEqual([100, 110])
    expect(r.adjustments.map((a) => a.runningTotal)).toEqual([1100, 990])
    expect(r.adjustedTotal).toBe(990)
  })

  it('order matters for percentage after a fixed amount', () => {
    const a = applyPriceAdjustments(1000, [fixed('addition', 200), pct('discount', 10)])
    const b = applyPriceAdjustments(1000, [pct('discount', 10), fixed('addition', 200)])
    expect(a.adjustedTotal).toBe(1080)
    expect(b.adjustedTotal).toBe(1100)
  })

  it('applies fixed additions and discounts as-is', () => {
    expect(applyPriceAdjustments(3000, [fixed('addition', 120.75)]).adjustedTotal).toBe(3120.75)
    expect(applyPriceAdjustments(3000, [fixed('discount', 500)]).adjustedTotal).toBe(2500)
  })

  it('treats a record without valueType as percentage (old records)', () => {
    const old = { id: 'o', type: 'addition', name: 'תוספת אילת', percentage: 9 } as PriceAdjustment
    expect(applyPriceAdjustments(1000, [old]).adjustedTotal).toBe(1090)
  })
})

describe('parsePriceAdjustments', () => {
  it('returns [] for non-arrays', () => {
    expect(parsePriceAdjustments(null)).toEqual([])
    expect(parsePriceAdjustments({})).toEqual([])
    expect(parsePriceAdjustments('[]')).toEqual([])
  })
  it('keeps valid percentage, fixed and old-format records', () => {
    const raw = [
      { id: '1', type: 'addition', name: 'a', valueType: 'percentage', percentage: 2.5 },
      { id: '2', type: 'discount', name: 'b', valueType: 'fixed', fixedAmount: 0 },
      { id: '3', type: 'addition', name: 'c', percentage: 9 },
    ]
    expect(parsePriceAdjustments(raw).map((a) => a.id)).toEqual(['1', '2', '3'])
  })
  it('drops malformed records', () => {
    const raw = [
      { id: '1', type: 'other', name: 'a', percentage: 1 },
      { id: '2', type: 'addition', name: 'b', valueType: 'fixed' }, // no amount
      { type: 'addition', name: 'c', percentage: 1 }, // no id
      null,
    ]
    expect(parsePriceAdjustments(raw)).toEqual([])
  })
})

describe('adjustmentDisplayLabel / roundMoney', () => {
  it('shows the percentage only for percentage adjustments', () => {
    expect(adjustmentDisplayLabel(pct('addition', 9, 'תוספת אילת'))).toBe('תוספת אילת 9%')
    expect(adjustmentDisplayLabel(fixed('addition', 100, 'תוספת קבועה'))).toBe('תוספת קבועה')
  })
  it('rounds half up at the agora boundary', () => {
    expect(roundMoney(87.525)).toBe(87.53)
    expect(roundMoney(1.005)).toBe(1.01)
  })
})
