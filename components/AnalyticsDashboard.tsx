'use client'

import { useState, useMemo } from 'react'
import { formatCurrency } from '@/lib/calculations'
import { applyFilters, computeKPIs, computeUserStats } from '@/lib/analytics/compute'
import type { RawQuote, RawProfile } from '@/lib/analytics/compute'

const QUOTE_STATUSES = [
  { value: '', label: 'כל הסטטוסים' },
  { value: 'draft', label: 'טיוטה' },
  { value: 'sent', label: 'נשלחה' },
  { value: 'accepted', label: 'אושרה' },
  { value: 'rejected', label: 'נדחתה' },
  { value: 'archived', label: 'ארכיון' },
]

const PAYMENT_STATUSES = [
  { value: '', label: 'כל סטטוסי תשלום' },
  { value: 'unpaid', label: 'לא שולם' },
  { value: 'partial', label: 'שולם חלקית' },
  { value: 'paid', label: 'שולם' },
  { value: 'closed_partial', label: 'שולם חלקית ונסגר' },
]

const STATUS_META: { key: string; label: string; color: string }[] = [
  { key: 'draft',    label: 'טיוטה',  color: '#9CA3AF' },
  { key: 'sent',     label: 'נשלחה',  color: '#3B82F6' },
  { key: 'accepted', label: 'אושרה',  color: '#16A34A' },
  { key: 'rejected', label: 'נדחתה',  color: '#F87171' },
  { key: 'archived', label: 'ארכיון', color: '#D1D5DB' },
]

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────

interface DonutSegment { label: string; color: string; value: number }

function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const cx = 80, cy = 80, R = 70, ri = 48
  const paths: { d: string; color: string }[] = []
  let angle = -Math.PI / 2

  for (const seg of segments) {
    if (seg.value <= 0) continue
    const sweep = (seg.value / total) * 2 * Math.PI
    const end = angle + sweep
    const large = sweep > Math.PI ? 1 : 0
    const x1 = cx + R * Math.cos(angle),   y1 = cy + R * Math.sin(angle)
    const x2 = cx + R * Math.cos(end),     y2 = cy + R * Math.sin(end)
    const ix1 = cx + ri * Math.cos(angle), iy1 = cy + ri * Math.sin(angle)
    const ix2 = cx + ri * Math.cos(end),   iy2 = cy + ri * Math.sin(end)
    paths.push({
      d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${ri} ${ri} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`,
      color: seg.color,
    })
    angle = end
  }

  return (
    <svg width="160" height="160" viewBox="0 0 160 160" className="flex-shrink-0">
      {total === 0 ? (
        <>
          <circle cx={cx} cy={cy} r={R} fill="#E5E7EB" />
          <circle cx={cx} cy={cy} r={ri} fill="white" />
        </>
      ) : paths.length === 1 ? (
        <>
          <circle cx={cx} cy={cy} r={R} fill={paths[0].color} />
          <circle cx={cx} cy={cy} r={ri} fill="white" />
        </>
      ) : (
        paths.map((p, i) => <path key={i} d={p.d} fill={p.color} />)
      )}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#111827" fontSize="22" fontWeight="bold">
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#9CA3AF" fontSize="11">
        הצעות
      </text>
    </svg>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  quotes: RawQuote[]
  profiles: RawProfile[]
}

export function AnalyticsDashboard({ quotes, profiles }: Props) {
  const [filterUserId, setFilterUserId] = useState('')
  const [filterFromDate, setFilterFromDate] = useState('')
  const [filterToDate, setFilterToDate] = useState('')
  const [filterQuoteStatus, setFilterQuoteStatus] = useState('')
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const hasActiveFilters = filterUserId || filterFromDate || filterToDate || filterQuoteStatus || filterPaymentStatus

  const filteredQuotes = useMemo(() => applyFilters(quotes, {
    userId: filterUserId || undefined,
    fromDate: filterFromDate || undefined,
    toDate: filterToDate || undefined,
    quoteStatus: filterQuoteStatus || undefined,
    paymentStatus: filterPaymentStatus || undefined,
  }), [quotes, filterUserId, filterFromDate, filterToDate, filterQuoteStatus, filterPaymentStatus])

  const kpi = useMemo(() => computeKPIs(filteredQuotes), [filteredQuotes])
  const userRows = useMemo(() => computeUserStats(filteredQuotes, profiles), [filteredQuotes, profiles])

  const exportUrl = (type: 'excel' | 'pdf') => {
    const params = new URLSearchParams()
    if (filterUserId) params.set('userId', filterUserId)
    if (filterFromDate) params.set('fromDate', filterFromDate)
    if (filterToDate) params.set('toDate', filterToDate)
    if (filterQuoteStatus) params.set('quoteStatus', filterQuoteStatus)
    if (filterPaymentStatus) params.set('paymentStatus', filterPaymentStatus)
    return `/api/admin/analytics/${type}?${params.toString()}`
  }

  const userOptions = useMemo(() => {
    const seen = new Set<string>()
    return profiles.filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true })
  }, [profiles])

  const clearFilters = () => {
    setFilterUserId(''); setFilterFromDate(''); setFilterToDate('')
    setFilterQuoteStatus(''); setFilterPaymentStatus('')
  }

  const donutSegments: DonutSegment[] = useMemo(() => {
    const counts: Record<string, number> = { draft: 0, sent: 0, accepted: 0, rejected: 0, archived: 0 }
    for (const q of filteredQuotes) {
      if (q.status in counts) counts[q.status]++
    }
    return STATUS_META.map(({ key, label, color }) => ({ label, color, value: counts[key] ?? 0 }))
  }, [filteredQuotes])

  const acceptancePct = kpi.totalCount > 0 ? Math.round((kpi.acceptedCount / kpi.totalCount) * 100) : 0

  return (
    <div className="space-y-5">

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`text-sm font-medium transition-colors ${hasActiveFilters ? 'text-orange-600' : 'text-gray-600'}`}
          >
            {showFilters ? 'הסתר סינונים' : 'סינונים'}{hasActiveFilters ? ' ●' : ''}
          </button>
          <div className="flex gap-2">
            <a
              href={exportUrl('excel')}
              download
              className="text-xs font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-700 bg-gray-50 active:bg-gray-100 transition-colors"
            >
              ↓ Excel
            </a>
            <a
              href={exportUrl('pdf')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-orange-600 text-white active:bg-orange-700 transition-colors"
            >
              ↓ PDF
            </a>
          </div>
        </div>

        {showFilters && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">משתמש</label>
                <select
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                >
                  <option value="">כולם</option>
                  {userOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">סטטוס הצעה</label>
                <select
                  value={filterQuoteStatus}
                  onChange={(e) => setFilterQuoteStatus(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                >
                  {QUOTE_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">מתאריך</label>
                <input
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">עד תאריך</label>
                <input
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">סטטוס תשלום (להצעות מאושרות)</label>
              <div className="flex gap-1.5 flex-wrap">
                {PAYMENT_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setFilterPaymentStatus(s.value)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                      filterPaymentStatus === s.value
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="text-xs text-orange-600 font-medium">
                נקה סינון
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">סה״כ הצעות</p>
          <p className="text-2xl font-bold text-gray-900">{kpi.totalCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">אושרו</p>
          <p className="text-2xl font-bold text-green-700">{kpi.acceptedCount}</p>
          {kpi.totalCount > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{acceptancePct}% מסך ההצעות</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">שולם</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(kpi.paidTotal)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">יתרה פתוחה</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(kpi.openBalance)}</p>
        </div>
      </div>

      {/* ── Donut chart + legend ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">התפלגות לפי סטטוס</h2>
        <div className="flex items-center gap-8 flex-wrap">
          <DonutChart segments={donutSegments} total={kpi.totalCount} />
          <div className="space-y-2.5 flex-1 min-w-[140px]">
            {donutSegments.map((seg) => (
              <div key={seg.label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-sm text-gray-600 flex-1">{seg.label}</span>
                <span className="text-sm font-semibold text-gray-900">{seg.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Per-user performance bars ── */}
      {userRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">ביצועים לפי נציג</h2>
          <div className="space-y-5">
            {userRows.map((row) => (
              <div key={row.userId}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium text-gray-800">{row.name}</span>
                  <span className="text-xs text-gray-400">
                    {row.accepted} / {row.total} אושרו
                    {row.total > 0 && (
                      <span className="font-semibold mr-1 text-gray-600">
                        {' '}({Math.round((row.accepted / row.total) * 100)}%)
                      </span>
                    )}
                  </span>
                </div>
                <Bar value={row.accepted} max={row.total} color="#16A34A" />
                {row.acceptedAmount > 0 && (
                  <>
                    <div className="flex justify-between items-center mt-2.5 mb-1.5">
                      <span className="text-xs text-gray-500">
                        גבייה: {formatCurrency(row.paidTotal)} מתוך {formatCurrency(row.acceptedAmount)}
                      </span>
                      <span className={`text-xs font-semibold ${
                        row.collectionPct >= 80 ? 'text-green-700' : row.collectionPct >= 40 ? 'text-orange-600' : 'text-red-500'
                      }`}>
                        {row.collectionPct}%
                      </span>
                    </div>
                    <Bar value={row.paidTotal} max={row.acceptedAmount} color="#F97316" />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Overpay cards ── */}
      {kpi.overpayCount > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-amber-50 rounded-2xl border border-amber-100 shadow-sm p-4">
            <p className="text-xs text-amber-600 mb-1">הצעות עם חריגים</p>
            <p className="text-2xl font-bold text-amber-700">{kpi.overpayCount}</p>
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-100 shadow-sm p-4">
            <p className="text-xs text-amber-600 mb-1">סך חריגים / תוספות</p>
            <p className="text-xl font-bold text-amber-700">{formatCurrency(kpi.overpayTotal)}</p>
          </div>
        </div>
      )}

      {/* ── Table 1: Quote performance ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">ביצועי הצעות לפי נציג</h2>
          <p className="text-xs text-gray-400 mt-0.5">{filteredQuotes.length} הצעות</p>
        </div>
        {userRows.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">אין נתונים</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[480px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-medium">
                  <th className="text-right px-4 py-2.5">שם</th>
                  <th className="text-center px-2 py-2.5">סה״כ</th>
                  <th className="text-center px-2 py-2.5">טיוטה</th>
                  <th className="text-center px-2 py-2.5">נשלח</th>
                  <th className="text-center px-2 py-2.5 text-green-600">אושר</th>
                  <th className="text-center px-2 py-2.5 text-red-400">נדחה</th>
                  <th className="text-center px-2 py-2.5">ארכיון</th>
                  <th className="text-center px-3 py-2.5">% אישור</th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((row, i) => (
                  <tr key={row.userId} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-3 font-semibold text-gray-900">{row.name}</td>
                    <td className="px-2 py-3 text-center font-medium text-gray-700">{row.total}</td>
                    <td className="px-2 py-3 text-center text-gray-400">{row.draft || '—'}</td>
                    <td className="px-2 py-3 text-center text-blue-500">{row.sent || '—'}</td>
                    <td className="px-2 py-3 text-center text-green-700 font-medium">{row.accepted || '—'}</td>
                    <td className="px-2 py-3 text-center text-red-400">{row.rejected || '—'}</td>
                    <td className="px-2 py-3 text-center text-gray-400">{row.archived || '—'}</td>
                    <td className="px-3 py-3 text-center">
                      {row.total > 0 ? (
                        <span className={`font-semibold ${
                          Math.round((row.accepted / row.total) * 100) >= 60 ? 'text-green-700'
                          : Math.round((row.accepted / row.total) * 100) >= 30 ? 'text-orange-600'
                          : 'text-red-500'
                        }`}>
                          {Math.round((row.accepted / row.total) * 100)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Table 2: Financial ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">נתונים פיננסיים לפי נציג</h2>
        </div>
        {userRows.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">אין נתונים</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-medium">
                  <th className="text-right px-4 py-2.5">שם</th>
                  <th className="text-right px-3 py-2.5">שווי מאושר</th>
                  <th className="text-right px-3 py-2.5">שולם</th>
                  <th className="text-right px-3 py-2.5 text-orange-600">יתרה פתוחה</th>
                  <th className="text-right px-3 py-2.5 text-gray-400">נסגרה</th>
                  <th className="text-center px-2 py-2.5">% גבייה</th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((row, i) => (
                  <tr key={row.userId} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-3 font-semibold text-gray-900">{row.name}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{row.acceptedAmount > 0 ? formatCurrency(row.acceptedAmount) : '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{row.paidTotal > 0 ? formatCurrency(row.paidTotal) : '—'}</td>
                    <td className="px-3 py-3 text-right font-medium text-orange-600">{row.openBalance > 0 ? formatCurrency(row.openBalance) : '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-400">{row.closedAdjustment > 0 ? formatCurrency(row.closedAdjustment) : '—'}</td>
                    <td className="px-2 py-3 text-center">
                      {row.acceptedAmount > 0 ? (
                        <span className={`font-semibold ${
                          row.collectionPct >= 80 ? 'text-green-700'
                          : row.collectionPct >= 40 ? 'text-orange-600'
                          : 'text-red-500'
                        }`}>
                          {row.collectionPct}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
