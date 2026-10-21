export interface PriceAdjustment {
  id: string
  type: 'addition' | 'discount'
  name: string
  // valueType defaults to 'percentage' when absent (backward compat with old records)
  valueType?: 'percentage' | 'fixed'
  percentage?: number
  fixedAmount?: number
}

export interface CalculatedAdjustment extends PriceAdjustment {
  amount: number
  runningTotal: number
}

export interface AdjustmentResult {
  baseAmount: number
  adjustments: CalculatedAdjustment[]
  adjustedTotal: number
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// Returns the label to show for an adjustment in summaries (UI, PDF, view page).
// Percentage: "תוספת אילת 9%"  Fixed: "תוספת קבועה"
export function adjustmentDisplayLabel(adj: PriceAdjustment): string {
  if ((adj.valueType ?? 'percentage') === 'fixed') return adj.name
  return `${adj.name} ${adj.percentage ?? 0}%`
}

// Each adjustment is applied sequentially to the running total.
// Fixed adjustments use their fixedAmount directly; percentage adjustments
// compute from the current runningTotal.
export function applyPriceAdjustments(
  baseAmount: number,
  adjustments: PriceAdjustment[]
): AdjustmentResult {
  if (!adjustments || adjustments.length === 0) {
    return {
      baseAmount: roundMoney(baseAmount),
      adjustments: [],
      adjustedTotal: roundMoney(baseAmount),
    }
  }

  let runningTotal = roundMoney(baseAmount)

  const calculatedAdjustments: CalculatedAdjustment[] = adjustments.map((adjustment) => {
    const effectiveValueType = adjustment.valueType ?? 'percentage'
    const amount =
      effectiveValueType === 'fixed'
        ? roundMoney(adjustment.fixedAmount ?? 0)
        : roundMoney(runningTotal * ((adjustment.percentage ?? 0) / 100))

    if (adjustment.type === 'addition') {
      runningTotal = roundMoney(runningTotal + amount)
    } else {
      runningTotal = roundMoney(runningTotal - amount)
    }

    return { ...adjustment, amount, runningTotal }
  })

  return {
    baseAmount: roundMoney(baseAmount),
    adjustments: calculatedAdjustments,
    adjustedTotal: runningTotal,
  }
}

export function parsePriceAdjustments(raw: unknown): PriceAdjustment[] {
  if (!Array.isArray(raw)) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return raw.filter((a): a is PriceAdjustment => {
    if (a === null || typeof a !== 'object') return false
    if (a.type !== 'addition' && a.type !== 'discount') return false
    if (typeof a.name !== 'string') return false
    if (typeof a.id !== 'string') return false
    // Accept old records (percentage only) and new records (percentage or fixed)
    const hasPercentage = typeof a.percentage === 'number'
    const hasFixed = a.valueType === 'fixed' && typeof a.fixedAmount === 'number'
    return hasPercentage || hasFixed
  })
}
