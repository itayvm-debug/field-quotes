'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  STATUS_LABELS, STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS,
  type QuoteStatus, type PaymentStatus,
} from '@/types'
import { formatCurrency } from '@/lib/calculations'
import { shareQuotePdf } from '@/lib/share/shareQuotePdf'

const ACTIVE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected']
const PAYMENT_STATUS_ORDER: PaymentStatus[] = ['unpaid', 'partial', 'paid', 'closed_partial']
const REJECT_REASONS = [
  'מחיר גבוה מדי',
  'בוצע על ידי קבלן אחר',
  'הלקוח דחה את העבודה',
  'העבודה בוטלה',
  'ממתין לתקציב / אין תקציב מאושר',
  'שינוי תכולת עבודה',
  'מועד ביצוע לא מתאים',
  'לא ידוע',
  'אחר',
]

interface PendingPaymentRequest {
  id: string
  requested_payment_status: string
  requested_paid_amount: number
  requested_closed_payment_note: string
  requested_overpayment_note: string
  requester_note: string
  requested_at: string
}

interface Props {
  quoteId: string
  quoteNumber: string | null
  clientName: string
  totalAmount: number
  currentStatus: string
  userRole: string
  userId: string
  companyName: string
  initialPaymentStatus: PaymentStatus
  initialPaidAmount: number
  initialClosedPaymentNote: string
  initialPaymentClosedAt: string | null
  paymentClosedByName: string | null
  initialStatusNote?: string
  initialOverpaymentNote?: string
  pendingPaymentRequest?: PendingPaymentRequest | null
}

export function QuoteActionsPanel({
  quoteId, quoteNumber, totalAmount,
  currentStatus, userRole, userId, companyName,
  initialPaymentStatus, initialPaidAmount, initialClosedPaymentNote,
  initialPaymentClosedAt, paymentClosedByName,
  initialStatusNote = '', initialOverpaymentNote = '',
  pendingPaymentRequest,
}: Props) {
  const router = useRouter()

  const [status, setStatus] = useState(currentStatus)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Rejection reason state
  const [pendingReject, setPendingReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectOther, setRejectOther] = useState('')

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initialPaymentStatus)
  const [paidAmountStr, setPaidAmountStr] = useState(
    initialPaidAmount > 0 ? String(initialPaidAmount) : ''
  )
  const [closedNote, setClosedNote] = useState(initialClosedPaymentNote)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  // Overpayment state (requires migration 008)
  const [showOverpayDialog, setShowOverpayDialog] = useState(false)
  const [overpayChoice, setOverpayChoice] = useState<'yes' | 'no' | null>(null)
  const [overpaymentNote, setOverpaymentNote] = useState(initialOverpaymentNote)

  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [archiveWorking, setArchiveWorking] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteWorking, setDeleteWorking] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'loading' | 'unsupported'>('idle')

  // Payment request (non-admin) / inline review (admin)
  const [hasPendingRequest, setHasPendingRequest] = useState(!!pendingPaymentRequest)
  const [inlineReviewAction, setInlineReviewAction] = useState<'approve' | 'reject' | null>(null)
  const [inlineAdminNote, setInlineAdminNote] = useState('')
  const [inlineReviewing, setInlineReviewing] = useState(false)
  const [inlineReviewError, setInlineReviewError] = useState('')

  const isArchived = status === 'archived'
  const isAdmin = userRole === 'admin'
  const canEdit = userRole !== 'viewer'

  const paidAmount = parseFloat(paidAmountStr) || 0
  const paidPct = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0
  const balance = totalAmount - paidAmount
  const isSavedClosure = initialPaymentStatus === 'closed_partial' && paymentStatus === 'closed_partial'
  const showAmountInput = paymentStatus === 'partial' || paymentStatus === 'closed_partial' || paymentStatus === 'paid'
  const showCloseNote = paymentStatus === 'closed_partial'
  const isOverpay = paidAmount > totalAmount

  const displayStatus = pendingReject ? 'rejected' : status

  const handleStatusClick = (next: QuoteStatus) => {
    if (next === displayStatus || statusUpdating) return
    if (next === 'rejected') {
      setPendingReject(true)
      setRejectReason('')
      setRejectOther('')
      return
    }
    setPendingReject(false)
    void doChangeStatus(next)
  }

  const doChangeStatus = async (next: QuoteStatus) => {
    setStatusUpdating(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('quotes').update({ status: next }).eq('id', quoteId)
    setStatus(next)
    setStatusUpdating(false)
    router.refresh()
  }

  const confirmReject = async () => {
    const note = rejectReason === 'אחר' ? rejectOther.trim() : rejectReason
    if (!note) return
    setStatusUpdating(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('quotes').update({ status: 'rejected', status_note: note }).eq('id', quoteId)
    setStatus('rejected')
    setPendingReject(false)
    setStatusUpdating(false)
    router.refresh()
  }

  const resetOverpayDialog = () => {
    setShowOverpayDialog(false)
    setOverpayChoice(null)
  }

  const handlePaymentStatusSelect = (s: PaymentStatus) => {
    if (!canEdit) return
    setPaymentStatus(s)
    setPaymentError('')
    resetOverpayDialog()
    if (s === 'paid') setPaidAmountStr(String(totalAmount))
    else if (s === 'unpaid') { setPaidAmountStr(''); setClosedNote('') }
  }

  const doPaymentSave = async () => {
    setPaymentSaving(true)
    setPaymentError('')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: Record<string, any>
    if (paymentStatus === 'unpaid') {
      payload = { payment_status: 'unpaid', paid_amount: 0 }
    } else if (paymentStatus === 'partial') {
      payload = { payment_status: 'partial', paid_amount: paidAmount }
    } else if (paymentStatus === 'paid') {
      payload = { payment_status: 'paid', paid_amount: paidAmount }
    } else {
      payload = { payment_status: 'closed_partial', paid_amount: paidAmount, closed_payment_note: closedNote.trim(), payment_closed_by: userId }
    }

    // migration 008: include overpayment_note when overpayment confirmed, clear otherwise
    if (isOverpay && overpayChoice === 'yes' && overpaymentNote.trim()) {
      payload.overpayment_note = overpaymentNote.trim()
    } else {
      payload.overpayment_note = ''
    }

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbErr } = await (supabase.from('quotes').update(payload as any).eq('id', quoteId))
    if (dbErr) {
      setPaymentError(`שגיאה בשמירה: ${dbErr.message}`)
    } else {
      resetOverpayDialog()
      router.refresh()
    }
    setPaymentSaving(false)
  }

  const doSubmitPaymentRequest = async () => {
    setPaymentSaving(true)
    setPaymentError('')

    const res = await fetch(`/api/quotes/${quoteId}/payment-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requested_payment_status: paymentStatus,
        requested_paid_amount: paidAmount,
        requested_closed_payment_note: closedNote.trim(),
        requested_overpayment_note: isOverpay && overpayChoice === 'yes' ? overpaymentNote.trim() : '',
        requester_note: '',
      }),
    })

    if (res.ok) {
      setHasPendingRequest(true)
      resetOverpayDialog()
      router.refresh()
    } else {
      const data = await res.json()
      setPaymentError(data.error ?? 'שגיאה בשליחת הבקשה')
    }
    setPaymentSaving(false)
  }

  const handlePaymentSave = async () => {
    if (!canEdit) return
    if ((paymentStatus === 'partial' || paymentStatus === 'closed_partial') && paidAmount <= 0) {
      setPaymentError('יש להזין סכום ששולם גדול מ-0')
      return
    }
    if (paymentStatus === 'closed_partial' && !closedNote.trim()) {
      setPaymentError('יש למלא סיבת סגירה / קיזוז')
      return
    }
    // If overpayment: show dialog first, don't save yet
    if (isOverpay) {
      setShowOverpayDialog(true)
      setOverpayChoice(null)
      return
    }
    // Admin saves directly; non-admin submits a request
    if (isAdmin) {
      await doPaymentSave()
    } else {
      await doSubmitPaymentRequest()
    }
  }

  const handleInlineReview = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !inlineAdminNote.trim()) {
      setInlineReviewAction('reject')
      return
    }
    if (!pendingPaymentRequest) return
    setInlineReviewing(true)
    setInlineReviewError('')

    const res = await fetch(`/api/admin/payment-requests/${pendingPaymentRequest.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, admin_note: inlineAdminNote }),
    })

    if (res.ok) {
      setHasPendingRequest(false)
      setInlineReviewAction(null)
      setInlineAdminNote('')
      router.push(`/quotes/${quoteId}`)
    } else {
      const data = await res.json()
      setInlineReviewError(data.error ?? 'שגיאה')
    }
    setInlineReviewing(false)
  }

  const handleArchive = async () => {
    setArchiveWorking(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('quotes').update({ status: 'archived' as any }).eq('id', quoteId)
    router.push('/dashboard')
  }

  const handleRestore = async () => {
    setArchiveWorking(true)
    const supabase = createClient()
    await supabase.from('quotes').update({ status: 'draft' }).eq('id', quoteId)
    setStatus('draft')
    setArchiveWorking(false)
    setArchiveConfirm(false)
    router.refresh()
  }

  const handlePermanentDelete = async () => {
    setDeleteWorking(true)
    const supabase = createClient()
    const { data: itemRows } = await supabase.from('quote_items').select('id').eq('quote_id', quoteId)
    const itemIds = (itemRows ?? []).map((r) => r.id)
    if (itemIds.length > 0) {
      const { data: imgRows } = await supabase.from('item_images').select('storage_path').in('item_id', itemIds)
      const paths = (imgRows ?? []).map((r) => r.storage_path)
      if (paths.length > 0) await supabase.storage.from('quote-images').remove(paths)
    }
    await supabase.from('quotes').delete().eq('id', quoteId)
    router.push('/dashboard?status=archived')
  }

  const handleSharePdf = async () => {
    setShareState('loading')
    const result = await shareQuotePdf(quoteId, quoteNumber, companyName)
    if (result.status === 'fallback') {
      setShareState('unsupported')
    } else if (result.status === 'error') {
      router.push(`/quotes/${quoteId}/pdf-view`)
      setShareState('idle')
    } else {
      setShareState('idle')
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Status + Payment */}
      {canEdit && !isArchived && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-2.5">שנה סטטוס</p>
          <div className="flex gap-1.5 flex-wrap">
            {ACTIVE_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleStatusClick(s)}
                disabled={statusUpdating}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-60 ${
                  s === displayStatus ? STATUS_COLORS[s] : 'bg-gray-100 text-gray-500 active:bg-gray-200'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Show saved rejection reason */}
          {status === 'rejected' && initialStatusNote && !pendingReject && (
            <p className="text-xs text-gray-400 mt-2">
              סיבת דחייה: <span className="font-medium text-red-600">{initialStatusNote}</span>
            </p>
          )}

          {/* Rejection reason picker */}
          {pendingReject && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">
                סיבת דחייה <span className="text-red-400">*</span>
              </p>
              <div className="flex flex-col gap-1.5">
                {REJECT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRejectReason(r)}
                    className={`text-xs px-3 py-2 rounded-xl text-right transition-colors ${
                      r === rejectReason
                        ? 'bg-red-50 border border-red-300 text-red-700 font-medium'
                        : 'bg-gray-50 text-gray-600 active:bg-gray-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {rejectReason === 'אחר' && (
                <input
                  type="text"
                  value={rejectOther}
                  onChange={(e) => setRejectOther(e.target.value)}
                  placeholder="פרט את הסיבה..."
                  className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              )}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => { setPendingReject(false); setRejectReason(''); setRejectOther('') }}
                  disabled={statusUpdating}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 bg-white disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={confirmReject}
                  disabled={statusUpdating || !rejectReason || (rejectReason === 'אחר' && !rejectOther.trim())}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {statusUpdating ? 'שומר...' : 'אשר דחייה'}
                </button>
              </div>
            </div>
          )}

          {/* Payment section */}
          {status === 'accepted' && !pendingReject && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2.5">סטטוס תשלום</p>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {PAYMENT_STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handlePaymentStatusSelect(s)}
                    disabled={!canEdit}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors disabled:cursor-default ${
                      s === paymentStatus ? PAYMENT_STATUS_COLORS[s] : 'bg-gray-100 text-gray-500 active:bg-gray-200'
                    }`}
                  >
                    {PAYMENT_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              {showAmountInput && (
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">סכום ששולם (₪)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmountStr}
                    onChange={(e) => {
                      setPaidAmountStr(e.target.value)
                      setPaymentError('')
                      resetOverpayDialog()
                    }}
                    disabled={!canEdit || paymentSaving}
                    placeholder="הזן סכום"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50"
                  />
                  {paidAmount > 0 && !isOverpay && (
                    <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                      <span>{paidPct}% שולם מתוך {formatCurrency(totalAmount)}</span>
                      {paymentStatus === 'partial' && balance > 0 && (
                        <span className="text-orange-600 font-medium">יתרה: {formatCurrency(balance)}</span>
                      )}
                      {paymentStatus === 'closed_partial' && balance > 0 && (
                        <span className="text-gray-500">יתרה שנסגרה: {formatCurrency(balance)}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {paymentStatus === 'paid' && paidAmount === totalAmount && (
                <p className="text-xs text-green-600 mb-1.5 font-medium">
                  {formatCurrency(totalAmount)} שולם במלואו ✓
                </p>
              )}

              {showCloseNote && (
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">
                    סיבת סגירה / קיזוז <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={closedNote}
                    onChange={(e) => { setClosedNote(e.target.value); setPaymentError('') }}
                    disabled={!canEdit || paymentSaving}
                    placeholder='לדוגמה: "קיזוז שאושר מול המזמין"'
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50"
                  />
                </div>
              )}

              {isSavedClosure && (paymentClosedByName || initialPaymentClosedAt) && (
                <p className="text-xs text-gray-400 mb-3">
                  נסגר{paymentClosedByName ? ` על ידי ${paymentClosedByName}` : ''}
                  {initialPaymentClosedAt
                    ? ` · ${new Date(initialPaymentClosedAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : ''}
                </p>
              )}

              {/* ── Overpayment dialog ─────────────────────────────────── */}
              {showOverpayDialog && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 space-y-3">
                  <p className="text-sm font-medium text-amber-900">
                    הסכום ששולם ({formatCurrency(paidAmount)}) גבוה מסכום ההצעה ({formatCurrency(totalAmount)}).
                    האם קיימים חריגים / תוספות שאושרו?
                  </p>

                  {overpayChoice === null && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOverpayChoice('no')}
                        className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white active:bg-gray-50"
                      >
                        לא
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverpayChoice('yes')}
                        className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-semibold active:bg-orange-700"
                      >
                        כן
                      </button>
                    </div>
                  )}

                  {overpayChoice === 'no' && (
                    <div className="space-y-2">
                      <p className="text-sm text-red-700 font-medium">
                        לא ניתן להזין סכום גבוה מסכום ההצעה ללא פירוט חריגים.
                      </p>
                      <button
                        type="button"
                        onClick={resetOverpayDialog}
                        className="text-xs text-gray-500 underline"
                      >
                        חזור ותקן את הסכום
                      </button>
                    </div>
                  )}

                  {overpayChoice === 'yes' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          פירוט חריגים / תוספות <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={overpaymentNote}
                          onChange={(e) => { setOverpaymentNote(e.target.value); setPaymentError('') }}
                          disabled={paymentSaving}
                          placeholder='לדוגמה: "תוספות חומרים שאושרו בהסכם"'
                          className="w-full border border-amber-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={resetOverpayDialog}
                          disabled={paymentSaving}
                          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 bg-white disabled:opacity-50"
                        >
                          ביטול
                        </button>
                        <button
                          type="button"
                          onClick={isAdmin ? doPaymentSave : doSubmitPaymentRequest}
                          disabled={!overpaymentNote.trim() || paymentSaving}
                          className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                        >
                          {paymentSaving ? 'שומר...' : (isAdmin ? 'אשר ושמור' : 'שלח לבדיקה')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Show saved overpayment note as read-only */}
              {initialOverpaymentNote && !showOverpayDialog && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
                  <p className="text-xs text-amber-600 font-medium mb-0.5">חריגים / תוספות שמורים</p>
                  <p className="text-xs text-amber-900">{initialOverpaymentNote}</p>
                </div>
              )}

              {paymentError && <p className="text-xs text-red-500 mb-2">{paymentError}</p>}

              {/* Main save button — hidden while overpay dialog is active */}
              {canEdit && !showOverpayDialog && (
                <button
                  type="button"
                  onClick={handlePaymentSave}
                  disabled={paymentSaving}
                  className="w-full py-2.5 bg-orange-600 text-white rounded-xl text-sm font-semibold active:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {paymentSaving
                    ? (isAdmin ? 'שומר...' : 'שולח...')
                    : (isAdmin
                      ? 'שמור סטטוס תשלום'
                      : (hasPendingRequest ? 'עדכן בקשה' : 'שלח לבדיקה')
                    )
                  }
                </button>
              )}

              {/* Pending payment request card */}
              {hasPendingRequest && pendingPaymentRequest && (
                <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-orange-800">
                    {isAdmin ? 'בקשת שינוי תשלום ממתינה לאישור' : 'הבקשה נשלחה — ממתינה לאישור אדמין'}
                  </p>
                  <div className="text-xs text-orange-700 space-y-1">
                    <p>סטטוס מבוקש: {PAYMENT_STATUS_LABELS[pendingPaymentRequest.requested_payment_status as PaymentStatus] ?? pendingPaymentRequest.requested_payment_status}</p>
                    {pendingPaymentRequest.requested_paid_amount > 0 && (
                      <p>סכום: {formatCurrency(pendingPaymentRequest.requested_paid_amount)}</p>
                    )}
                    {pendingPaymentRequest.requested_overpayment_note && (
                      <p>חריגים: {pendingPaymentRequest.requested_overpayment_note}</p>
                    )}
                    {pendingPaymentRequest.requester_note && (
                      <p>הערה: {pendingPaymentRequest.requester_note}</p>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="pt-2 border-t border-orange-200 space-y-2">
                      {inlineReviewAction === 'reject' && (
                        <input
                          type="text"
                          value={inlineAdminNote}
                          onChange={(e) => setInlineAdminNote(e.target.value)}
                          placeholder="סיבת דחייה (חובה)"
                          disabled={inlineReviewing}
                          className="w-full border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white disabled:opacity-50"
                        />
                      )}
                      {inlineReviewError && (
                        <p className="text-xs text-red-600">{inlineReviewError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleInlineReview('reject')}
                          disabled={inlineReviewing}
                          className="flex-1 py-2 border border-red-200 bg-red-50 text-red-600 rounded-xl text-xs font-semibold disabled:opacity-50"
                        >
                          {inlineReviewing ? '...' : 'דחה'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInlineReview('approve')}
                          disabled={inlineReviewing}
                          className="flex-1 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                        >
                          {inlineReviewing ? 'מאשר...' : 'אשר'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Share PDF + Archive/Restore/Delete */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        {shareState === 'unsupported' ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              שיתוף קובץ PDF נתמך בעיקר בטלפון. פתח מהטלפון כדי לשתף ישירות.
            </p>
            <button type="button" onClick={() => setShareState('idle')}
              className="w-full py-2 rounded-xl text-xs text-gray-400 active:text-gray-600">
              הבנתי
            </button>
          </div>
        ) : (
          <button type="button" onClick={handleSharePdf} disabled={shareState === 'loading'}
            className="w-full py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-sm font-semibold active:bg-gray-100 transition-colors disabled:opacity-50">
            {shareState === 'loading' ? 'מכין קובץ PDF...' : 'שתף PDF'}
          </button>
        )}

        {!isArchived && canEdit && !archiveConfirm && (
          <button type="button" onClick={() => setArchiveConfirm(true)}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium active:bg-gray-50">
            העבר לארכיון
          </button>
        )}

        {!isArchived && archiveConfirm && (
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <p className="text-sm text-gray-700 font-medium text-center">להעביר לארכיון?</p>
            <div className="flex gap-2">
              <button onClick={() => setArchiveConfirm(false)} disabled={archiveWorking}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 bg-white disabled:opacity-50">ביטול</button>
              <button onClick={handleArchive} disabled={archiveWorking}
                className="flex-1 py-2.5 bg-gray-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {archiveWorking ? 'מעביר...' : 'כן, ארכיון'}
              </button>
            </div>
          </div>
        )}

        {isArchived && (
          <div className="space-y-2">
            <button onClick={handleRestore} disabled={archiveWorking}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium active:bg-gray-50 disabled:opacity-50">
              {archiveWorking ? 'משחזר...' : 'שחזר מארכיון'}
            </button>
            {isAdmin && !deleteConfirm && (
              <button onClick={() => setDeleteConfirm(true)}
                className="w-full py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-medium active:bg-red-100">
                מחק לצמיתות
              </button>
            )}
            {isAdmin && deleteConfirm && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                <p className="text-sm text-red-700 font-medium text-center">מחיקה בלתי הפיכה — להמשיך?</p>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteConfirm(false)} disabled={deleteWorking}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 bg-white disabled:opacity-50">ביטול</button>
                  <button onClick={handlePermanentDelete} disabled={deleteWorking}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                    {deleteWorking ? 'מוחק...' : 'מחק לצמיתות'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
