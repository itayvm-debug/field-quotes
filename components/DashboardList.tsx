'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { calcSubtotal, calcVat, calcTotal, formatCurrency, formatDate } from '@/lib/calculations'
import {
  STATUS_LABELS, STATUS_COLORS,
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS,
  type QuoteStatus, type QuoteItemDraft, type PaymentStatus,
} from '@/types'
import { QuoteCardActions } from '@/components/QuoteCardActions'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quotes: any[]
  statusFilter: string
  userRole: string
  userId: string
  companyName: string
  creatorProfiles?: Array<{ id: string; full_name: string; job_title: string }>
}

const PAYMENT_FILTERS: Array<{ value: PaymentStatus | ''; label: string }> = [
  { value: '', label: 'הכל' },
  { value: 'unpaid', label: 'לא שולם' },
  { value: 'partial', label: 'חלקי' },
  { value: 'paid', label: 'שולם' },
  { value: 'closed_partial', label: 'נסגר' },
]

export function DashboardList({ quotes, statusFilter, userRole, userId, companyName, creatorProfiles = [] }: Props) {
  const isAdmin = userRole === 'admin'
  const profileMap = new Map(creatorProfiles.map((p) => [p.id, p]))
  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | ''>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const hasAdvancedFilters = paymentFilter !== '' || fromDate !== '' || toDate !== ''

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return quotes.filter((quote) => {
      if (q) {
        const haystack = [
          quote.client_name ?? '',
          quote.client_contact ?? '',
          quote.project_description ?? '',
          quote.quote_number ?? '',
        ].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (paymentFilter) {
        if ((quote.payment_status ?? 'unpaid') !== paymentFilter) return false
      }
      if (fromDate && quote.quote_date < fromDate) return false
      if (toDate && quote.quote_date > toDate) return false
      return true
    })
  }, [quotes, search, paymentFilter, fromDate, toDate])

  const STATUS_LABEL_MAP: Record<string, string> = { ...STATUS_LABELS, '': 'הכל' }
  const statusLabel = STATUS_LABEL_MAP[statusFilter] ?? 'הכל'
  const isFiltering = search.trim() !== '' || hasAdvancedFilters

  return (
    <>
      {/* Search row */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex gap-2 items-center">
          <div className="relative flex-1">
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חפש לפי לקוח, תיאור, מספר הצעה..."
              className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`text-xs font-medium px-3 py-2 rounded-xl border transition-colors whitespace-nowrap ${
              hasAdvancedFilters
                ? 'bg-orange-50 border-orange-300 text-orange-700'
                : 'border-gray-200 text-gray-500 bg-white active:bg-gray-50'
            }`}
          >
            סינון{hasAdvancedFilters ? ' ●' : ''}
          </button>
        </div>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="max-w-2xl mx-auto space-y-3">
            {/* Payment status pills — only relevant when showing accepted quotes */}
            <div>
              <p className="text-xs text-gray-400 mb-1.5">סטטוס תשלום</p>
              <div className="flex gap-1.5 flex-wrap">
                {PAYMENT_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setPaymentFilter(f.value)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                      paymentFilter === f.value
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">מתאריך</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">עד תאריך</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                />
              </div>
            </div>

            {hasAdvancedFilters && (
              <button
                type="button"
                onClick={() => { setPaymentFilter(''); setFromDate(''); setToDate('') }}
                className="text-xs text-orange-600 font-medium"
              >
                נקה סינון
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quote list */}
      <main className="px-4 py-4 max-w-2xl mx-auto space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            {isFiltering ? (
              <p className="text-gray-400 text-lg">אין תוצאות לחיפוש</p>
            ) : (
              <>
                <p className="text-gray-400 text-lg">
                  {statusFilter ? `אין הצעות בסטטוס "${statusLabel}"` : 'אין הצעות עדיין'}
                </p>
                {!statusFilter && (
                  <p className="text-gray-300 text-sm mt-2">לחץ &quot;+ הצעה חדשה&quot; כדי להתחיל</p>
                )}
              </>
            )}
          </div>
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filtered.map((quote: any) => {
            const items = (quote.quote_items ?? []) as Array<{ quantity: number; unit_price: number }>
            const draftItems: QuoteItemDraft[] = items.map((i) => ({
              tempId: '',
              item_number: 0,
              description: '',
              unit: '',
              notes: '',
              quantity: String(i.quantity),
              unit_price: String(i.unit_price),
            }))
            const subtotal = calcSubtotal(draftItems)
            const vat = calcVat(subtotal, quote.vat_percentage)
            const total = calcTotal(subtotal, vat)
            const totalFormatted = formatCurrency(total)
            const quoteStatus = quote.status as QuoteStatus
            const paymentStatus = ((quote.payment_status) ?? 'unpaid') as PaymentStatus
            const paidAmount = parseFloat(quote.paid_amount ?? 0)
            const paidPct = total > 0 ? Math.round((paidAmount / total) * 100) : 0

            return (
              <div
                key={quote.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <Link
                  href={`/quotes/${quote.id}`}
                  className="block p-4 active:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[quoteStatus]}`}>
                          {STATUS_LABELS[quoteStatus]}
                        </span>
                        {quoteStatus === 'accepted' && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[paymentStatus]}`}>
                            {paymentStatus === 'partial'
                              ? `שולם חלקית ${paidPct}%`
                              : PAYMENT_STATUS_LABELS[paymentStatus]}
                          </span>
                        )}
                        {quote.overpayment_note && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            {paymentStatus === 'paid' ? 'שולם + חריגים' : 'כולל חריגים'}
                          </span>
                        )}
                        <span className="text-xs font-mono text-gray-400">
                          {quote.quote_number ?? '—'}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900 truncate">
                        {quote.client_name || '(ללא שם לקוח)'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">
                        {quote.project_description || 'ללא תיאור עבודה'}
                      </p>
                      {quote.overpayment_note && (
                        <p className="text-[11px] text-amber-600 mt-0.5 truncate">
                          חריגים: {quote.overpayment_note}
                        </p>
                      )}
                      {quoteStatus === 'rejected' && quote.status_note && (
                        <p className="text-xs text-red-500 mt-0.5 font-medium truncate">
                          {quote.status_note}
                        </p>
                      )}
                      {isAdmin && quote.user_id && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {(() => {
                            const p = profileMap.get(quote.user_id)
                            return p?.full_name || p?.job_title || 'משתמש ללא שם'
                          })()}
                          {' · '}{formatDate(quote.quote_date)}
                        </p>
                      )}
                      {!isAdmin && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDate(quote.quote_date)}
                        </p>
                      )}
                    </div>
                    <div className="text-left shrink-0">
                      <p className="font-bold text-gray-900 text-base">{totalFormatted}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {items.length} {items.length === 1 ? 'סעיף' : 'סעיפים'}
                      </p>
                    </div>
                  </div>
                </Link>

                <QuoteCardActions
                  quoteId={quote.id}
                  quoteNumber={quote.quote_number}
                  clientName={quote.client_name}
                  totalFormatted={totalFormatted}
                  totalAmount={total}
                  currentStatus={quote.status}
                  userRole={userRole}
                  userId={userId}
                  companyName={companyName}
                  initialPaymentStatus={paymentStatus}
                  initialPaidAmount={paidAmount}
                  initialStatusNote={quote.status_note ?? ''}
                />
              </div>
            )
          })
        )}
      </main>
    </>
  )
}
