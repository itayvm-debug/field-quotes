// Format a revision number for display.  0 → "VER00",  1 → "VER01", 27 → "VER27"
export function formatRevisionNumber(n: number | null | undefined): string {
  const num = typeof n === 'number' ? n : 0
  return `VER${String(num).padStart(2, '0')}`
}
