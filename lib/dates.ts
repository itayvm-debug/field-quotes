// Date-only helpers for 'YYYY-MM-DD' strings.
// Quotes are dated in Israel time regardless of where the code runs
// (browser, or a Vercel function in UTC), and day arithmetic is done in UTC
// so DST changes never shift the result by a day.

const ISRAEL_TZ = 'Asia/Jerusalem'

// Today's date in Israel as 'YYYY-MM-DD'.
export function todayIso(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function isoToUtcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDaysIso(iso: string, days: number): string {
  return new Date(isoToUtcMs(iso) + days * 86_400_000).toISOString().slice(0, 10)
}

export function daysBetweenIso(from: string, to: string): number {
  return Math.round((isoToUtcMs(to) - isoToUtcMs(from)) / 86_400_000)
}
