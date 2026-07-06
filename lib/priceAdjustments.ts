export interface PriceAdjustment {
  id: string
  type: 'addition' | 'discount'
  name: string
  percentage: number
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

// Each adjustment is applied to the running total of the previous step.
// Example: 100 +9% → 109, then 109 -5% → 103.55 (not 100 +9% -5% = 104).
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
    const amount = roundMoney(runningTotal * (adjustment.percentage / 100))

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
  return raw.filter(
    (a): a is PriceAdjustment =>
      a !== null &&
      typeof a === 'object' &&
      (a.type === 'addition' || a.type === 'discount') &&
      typeof a.name === 'string' &&
      typeof a.percentage === 'number' &&
      typeof a.id === 'string'
  )
}
