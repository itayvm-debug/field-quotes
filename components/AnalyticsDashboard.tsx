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
    return profiles.filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
  }, [profiles])

  const clearFilters = () => {
    setFilterUserId('')
    setFilterFromDate('')
    setFilterToDate('')
    setFilterQuoteStatus('')
    setFilterPaymentStatus('')
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`text-sm font-medium transition-colors ${
              hasActiveFilters ? 'text-orange-600' : 'text-gray-600'
            }`}
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
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-orange-600 font-medium"
              >
                נקה סינון
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">סה״כ הצעות</p>
          <p className="text-2xl font-bold text-gray-900">{kpi.totalCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">אושרו</p>
          <p className="text-2xl font-bold text-green-700">{kpi.acceptedCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">שולם</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(kpi.paidTotal)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">יתרה פתוחה</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(kpi.openBalance)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">יתרה שנסגרה</p>
          <p className="text-xl font-bold text-gray-500">{formatCurrency(kpi.closedAdjustment)}</p>
        </div>
      </div>

      {/* Overpay KPI cards — shown only when there are overpay quotes */}
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

      {/* Per-user table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">פירוט לפי משתמש</h2>
          <p className="text-xs text-gray-400 mt-0.5">{filteredQuotes.length} הצעות</p>
        </div>
        {userRows.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">אין נתונים</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-medium">
                  <th className="text-right px-4 py-2.5">שם</th>
                  <th className="text-right px-3 py-2.5">תפקיד</th>
                  <th className="text-center px-2 py-2.5">סה״כ</th>
                  <th className="text-center px-2 py-2.5">טיוטה</th>
                  <th className="text-center px-2 py-2.5">נשלח</th>
                  <th className="text-center px-2 py-2.5 text-green-600">אושר</th>
                  <th className="text-center px-2 py-2.5 text-red-400">נדחה</th>
                  <th className="text-center px-2 py-2.5">ארכיון</th>
                  <th className="text-right px-3 py-2.5">שווי כולל</th>
                  <th className="text-right px-3 py-2.5">שווי מאושר</th>
                  <th className="text-right px-3 py-2.5">שולם</th>
                  <th className="text-right px-3 py-2.5 text-orange-600">יתרה פתוחה</th>
                  <th className="text-right px-3 py-2.5 text-gray-400">יתרה שנסגרה</th>
                  <th className="text-center px-2 py-2.5">% גבייה</th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((row, i) => (
                  <tr key={row.userId} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-3 font-semibold text-gray-900">{row.name}</td>
                    <td className="px-3 py-3 text-gray-500">{row.role}</td>
                    <td className="px-2 py-3 text-center font-medium text-gray-700">{row.total}</td>
                    <td className="px-2 py-3 text-center text-gray-400">{row.draft || '—'}</td>
                    <td className="px-2 py-3 text-center text-blue-500">{row.sent || '—'}</td>
                    <td className="px-2 py-3 text-center text-green-700 font-medium">{row.accepted || '—'}</td>
                    <td className="px-2 py-3 text-center text-red-400">{row.rejected || '—'}</td>
                    <td className="px-2 py-3 text-center text-gray-400">{row.archived || '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{row.totalAmount > 0 ? formatCurrency(row.totalAmount) : '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{row.acceptedAmount > 0 ? formatCurrency(row.acceptedAmount) : '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{row.paidTotal > 0 ? formatCurrency(row.paidTotal) : '—'}</td>
                    <td className="px-3 py-3 text-right font-medium text-orange-600">{row.openBalance > 0 ? formatCurrency(row.openBalance) : '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-400">{row.closedAdjustment > 0 ? formatCurrency(row.closedAdjustment) : '—'}</td>
                    <td className="px-2 py-3 text-center">
                      {row.acceptedAmount > 0 ? (
                        <span className={`font-semibold ${row.collectionPct >= 80 ? 'text-green-700' : row.collectionPct >= 40 ? 'text-orange-600' : 'text-red-500'}`}>
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
