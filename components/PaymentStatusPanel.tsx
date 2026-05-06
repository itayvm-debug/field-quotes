'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/calculations'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, type PaymentStatus } from '@/types'

interface Props {
  quoteId: string
  totalAmount: number
  userRole: string
  userId: string
  initialPaymentStatus: PaymentStatus
  initialPaidAmount: number
  initialClosedPaymentNote: string
  initialPaymentClosedAt: string | null
  paymentClosedByName: string | null
}

export function PaymentStatusPanel({
  quoteId,
  totalAmount,
  userRole,
  userId,
  initialPaymentStatus,
  initialPaidAmount,
  initialClosedPaymentNote,
  initialPaymentClosedAt,
  paymentClosedByName,
}: Props) {
  const router = useRouter()
  const canEdit = userRole !== 'viewer'

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initialPaymentStatus)
  const [paidAmountStr, setPaidAmountStr] = useState(
    initialPaidAmount > 0 ? String(initialPaidAmount) : ''
  )
  const [closedNote, setClosedNote] = useState(initialClosedPaymentNote)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const paidAmount = parseFloat(paidAmountStr) || 0
  const paidPct = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0
  const balance = totalAmount - paidAmount

  const STATUS_ORDER: PaymentStatus[] = ['unpaid', 'partial', 'paid', 'closed_partial']

  const handleStatusSelect = (s: PaymentStatus) => {
    if (!canEdit) return
    setPaymentStatus(s)
    setError('')
    if (s === 'paid') {
      setPaidAmountStr(String(totalAmount))
    } else if (s === 'unpaid') {
      setPaidAmountStr('')
      setClosedNote('')
    }
  }

  const handleSave = async () => {
    if (!canEdit) return
    if ((paymentStatus === 'partial' || paymentStatus === 'closed_partial') && paidAmount <= 0) {
      setError('יש להזין סכום ששולם גדול מ-0')
      return
    }
    if (paymentStatus === 'closed_partial' && !closedNote.trim()) {
      setError('יש למלא סיבת סגירה / קיזוז')
      return
    }

    setSaving(true)
    setError('')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: Record<string, any>

    if (paymentStatus === 'unpaid') {
      payload = {
        payment_status: 'unpaid',
        paid_amount: 0,
        paid_at: null,
        payment_closed_at: null,
        payment_closed_by: null,
        closed_payment_note: '',
      }
    } else if (paymentStatus === 'partial') {
      payload = {
        payment_status: 'partial',
        paid_amount: paidAmount,
        payment_closed_at: null,
        payment_closed_by: null,
        closed_payment_note: '',
      }
    } else if (paymentStatus === 'paid') {
      payload = {
        payment_status: 'paid',
        paid_amount: totalAmount,
        payment_closed_at: null,
        payment_closed_by: null,
        closed_payment_note: '',
      }
    } else {
      // closed_partial
      payload = {
        payment_status: 'closed_partial',
        paid_amount: paidAmount,
        closed_payment_note: closedNote.trim(),
        payment_closed_by: userId,
      }
    }

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbErr } = await supabase.from('quotes').update(payload as any).eq('id', quoteId)
    if (dbErr) {
      setError('שגיאה בשמירה — נסה שוב')
    } else {
      router.refresh()
    }
    setSaving(false)
  }

  const showAmountInput = paymentStatus === 'partial' || paymentStatus === 'closed_partial'
  const showCloseNote = paymentStatus === 'closed_partial'
  const isSavedClosure = initialPaymentStatus === 'closed_partial' && paymentStatus === 'closed_partial'

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs text-gray-400 mb-3">סטטוס תשלום</p>

      {/* Status selector */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleStatusSelect(s)}
            disabled={!canEdit}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors disabled:cursor-default ${
              s === paymentStatus
                ? PAYMENT_STATUS_COLORS[s]
                : 'bg-gray-100 text-gray-500 active:bg-gray-200'
            }`}
          >
            {PAYMENT_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Amount input */}
      {showAmountInput && (
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">סכום ששולם (₪)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={paidAmountStr}
            onChange={(e) => { setPaidAmountStr(e.target.value); setError('') }}
            disabled={!canEdit || saving}
            placeholder="הזן סכום"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50"
          />
          {paidAmount > 0 && (
            <div className="flex justify-between text-xs text-gray-400 mt-1.5">
              <span>{paidPct}% שולם מתוך {formatCurrency(totalAmount)}</span>
              {paymentStatus === 'partial' && balance > 0 && (
                <span className="text-orange-600 font-medium">יתרה לגבייה: {formatCurrency(balance)}</span>
              )}
              {paymentStatus === 'closed_partial' && balance > 0 && (
                <span className="text-gray-500">יתרה שנסגרה: {formatCurrency(balance)}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Paid in full summary */}
      {paymentStatus === 'paid' && (
        <p className="text-xs text-green-600 mb-3 font-medium">
          {formatCurrency(totalAmount)} שולם במלואו ✓
        </p>
      )}

      {/* Closure note */}
      {showCloseNote && (
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">
            סיבת סגירה / קיזוז <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={closedNote}
            onChange={(e) => { setClosedNote(e.target.value); setError('') }}
            disabled={!canEdit || saving}
            placeholder='לדוגמה: "קיזוז שאושר מול המזמין", "ויתור יתרה"'
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50"
          />
        </div>
      )}

      {/* Closure metadata (read-only) */}
      {isSavedClosure && (paymentClosedByName || initialPaymentClosedAt) && (
        <p className="text-xs text-gray-400 mb-3">
          נסגר
          {paymentClosedByName ? ` על ידי ${paymentClosedByName}` : ''}
          {initialPaymentClosedAt
            ? ` · ${new Date(initialPaymentClosedAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : ''}
        </p>
      )}

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {canEdit && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-orange-600 text-white rounded-xl text-sm font-semibold active:bg-orange-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'שומר...' : 'שמור סטטוס תשלום'}
        </button>
      )}
    </section>
  )
}
