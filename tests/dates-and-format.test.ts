import { describe, it, expect, vi, afterEach } from 'vitest'
import { todayIso, addDaysIso, daysBetweenIso } from '@/lib/dates'
import { formatRevisionNumber } from '@/lib/revisionNumber'
import { buildQuotePdfFilename } from '@/lib/share/shareQuotePdf'

afterEach(() => {
  vi.useRealTimers()
})

describe('dates', () => {
  it('adds days across the spring DST change without losing a day', () => {
    expect(addDaysIso('2026-03-20', 30)).toBe('2026-04-19')
  })
  it('adds days across the autumn DST change, month and year ends, leap day', () => {
    expect(addDaysIso('2026-10-01', 30)).toBe('2026-10-31')
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29')
  })
  it('counts days between dates', () => {
    expect(daysBetweenIso('2026-10-23', '2026-12-22')).toBe(60)
    expect(daysBetweenIso('2026-03-20', '2026-04-19')).toBe(30)
  })
  it('todayIso is the Israel date even when UTC is still the previous day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-20T23:30:00Z')) // 01:30 on Nov 21 in Israel
    expect(todayIso()).toBe('2026-11-21')
    vi.setSystemTime(new Date('2026-07-15T21:30:00Z')) // 00:30 on Jul 16 (summer time)
    expect(todayIso()).toBe('2026-07-16')
  })
})

describe('revision numbers and PDF filenames', () => {
  it('formats revision numbers', () => {
    expect(formatRevisionNumber(0)).toBe('VER00')
    expect(formatRevisionNumber(7)).toBe('VER07')
    expect(formatRevisionNumber(27)).toBe('VER27')
    expect(formatRevisionNumber(null)).toBe('VER00')
  })
  it('builds the PDF filename with the revision', () => {
    expect(buildQuotePdfFilename('20112026-01', 1)).toBe('natan-valdman-price-quote-20112026-01-ver01.pdf')
    expect(buildQuotePdfFilename(null, 0)).toBe('natan-valdman-price-quote-ver00.pdf')
  })
  it('strips characters that are illegal in filenames', () => {
    expect(buildQuotePdfFilename('12/34:56', 0)).toBe('natan-valdman-price-quote-123456-ver00.pdf')
  })
})
