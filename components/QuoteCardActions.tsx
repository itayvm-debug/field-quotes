'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { shareQuotePdf } from '@/lib/share/shareQuotePdf'
import {
  STATUS_LABELS, STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS,
  type QuoteStatus, type PaymentStatus,
} from '@/types'
import { formatCurrency } from '@/lib/calculations'

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

interface Props {
  quoteId: string
  quoteNumber: string | null
  clientName: string
  totalFormatted: string
  totalAmount: number
  currentStatus: string
  userRole: string
  userId: string
  companyName: string
  initialPaymentStatus: PaymentStatus
  initialPaidAmount: number
  initialStatusNote?: string
}

export function QuoteCardActions({
  quoteId, quoteNumber, totalFormatted, totalAmount,
  currentStatus, userRole, userId, companyName,
  initialPaymentStatus, initialPaidAmount, initialStatusNote = '',
}: Props) {
  const router = useRouter()

  const [step, setStep] = useState<'idle' | 'confirm-archive' | 'confirm-delete' | 'update-status'>('idle')
  const [working, setWorking] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'loading' | 'unsupported' | 'error'>('idle')

  // Status update state
  const [selectedStatus, setSelectedStatus] = useState<QuoteStatus>(currentStatus as QuoteStatus)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initialPaymentStatus)
  const [paidAmountStr, setPaidAmountStr] = useState(initialPaidAmount > 0 ? String(initialPaidAmount) : '')
  const [closedNote, setClosedNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [rejectOther, setRejectOther] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  // Overpayment state (requires migration 008)
  const [showOverpayDialog, setShowOverpayDialog] = useState(false)
  const [overpayChoice, setOverpayChoice] = useState<'yes' | 'no' | null>(null)
  const [overpaymentNote, setOverpaymentNote] = useState('')

  // Approval upload state
  const [approvalFile, setApprovalFile] = useState<File | null>(null)
  const [approvalNote, setApprovalNote] = useState('')
  const approvalInputRef = useRef<HTMLInputElement>(null)

  const isArchived = currentStatus === 'archived'
  const isAdmin = userRole === 'admin'
  const canEdit = userRole !== 'viewer'

  const paidAmount = parseFloat(paidAmountStr) || 0
  const balance = totalAmount - paidAmount
  const isOverpay = selectedStatus === 'accepted' &&
    (paymentStatus === 'partial' || paymentStatus === 'closed_partial' || paymentStatus === 'paid') &&
    paidAmount > totalAmount

  // Non-admin users must submit payment data through the approval flow
  const hasPaymentData = selectedStatus === 'accepted' && paymentStatus !== 'unpaid'

  const resetOverpayDialog = () => {
    setShowOverpayDialog(false)
    setOverpayChoice(null)
  }

  const openUpdatePanel = () => {
    setSelectedStatus(currentStatus as QuoteStatus)
    setPaymentStatus(initialPaymentStatus)
    setPaidAmountStr(initialPaidAmount > 0 ? String(initialPaidAmount) : '')
    setClosedNote('')
    setRejectReason('')
    setRejectOther('')
    setSaveError('')
    resetOverpayDialog()
    setOverpaymentNote('')
    setApprovalFile(null)
    setApprovalNote('')
    setStep('update-status')
  }

  const handleStatusSelect = (s: QuoteStatus) => {
    setSelectedStatus(s)
    setSaveError('')
    setRejectReason('')
    setRejectOther('')
    resetOverpayDialog()
    if (s === 'accepted' && selectedStatus !== 'accepted') {
      setPaymentStatus(s === currentStatus ? initialPaymentStatus : 'unpaid')
      setPaidAmountStr(s === currentStatus && initialPaidAmount > 0 ? String(initialPaidAmount) : '')
    }
  }

  const handlePaymentSelect = (s: PaymentStatus) => {
    setPaymentStatus(s)
    setSaveError('')
    resetOverpayDialog()
    if (s === 'paid') setPaidAmountStr(String(totalAmount))
    else if (s === 'unpaid') { setPaidAmountStr(''); setClosedNote('') }
  }

  const handleSaveUpdate = async () => {
    // Validation
    if (selectedStatus === 'accepted') {
      if ((paymentStatus === 'partial' || paymentStatus === 'closed_partial') && paidAmount <= 0) {
        setSaveError('יש להזין סכום ששולם גדול מ-0')
        return
      }
      if (paymentStatus === 'closed_partial' && !closedNote.trim()) {
        setSaveError('יש למלא סיבת סגירה')
        return
      }
      // Overpayment check
      if (isOverpay) {
        if (!showOverpayDialog) {
          setShowOverpayDialog(true)
          setOverpayChoice(null)
          return
        }
        if (overpayChoice === null) return  // waiting for user choice
        if (overpayChoice === 'no') {
          setSaveError('לא ניתן להזין סכום גבוה מסכום ההצעה ללא פירוט חריגים.')
          return
        }
        if (overpayChoice === 'yes' && !overpaymentNote.trim()) {
          setSaveError('יש למלא פירוט חריגים / תוספות')
          return
        }
      }
    }

    if (selectedStatus === 'rejected') {
      const note = rejectReason === 'אחר' ? rejectOther.trim() : rejectReason
      if (!note) {
        setSaveError('יש לבחור סיבת דחייה')
        return
      }
    }

    setSaving(true)
    setSaveError('')
    const supabase = createClient()

    // Non-admin with payment data → update quote status (if changing), then submit payment request
    if (!isAdmin && hasPaymentData) {
      if (selectedStatus !== currentStatus) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: statusErr } = await (supabase.from('quotes').update({ status: selectedStatus } as any).eq('id', quoteId))
        if (statusErr) {
          setSaveError(`שגיאה: ${statusErr.message}`)
          setSaving(false)
          return
        }
      }
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSaveError((data as { error?: string }).error ?? 'שגיאה בשליחת הבקשה')
        setSaving(false)
        return
      }
      if (approvalFile) {
        const fd = new FormData()
        fd.append('file', approvalFile)
        if (approvalNote.trim()) fd.append('note', approvalNote.trim())
        await fetch(`/api/quotes/${quoteId}/approvals`, { method: 'POST', body: fd })
        setApprovalFile(null)
        setApprovalNote('')
      }
      setSaving(false)
      setStep('idle')
      router.refresh()
      return
    }

    // Admin or no payment data: direct update to quotes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotePayload: Record<string, any> = { status: selectedStatus }

    if (selectedStatus === 'accepted') {
      if (paymentStatus === 'unpaid') {
        Object.assign(quotePayload, { payment_status: 'unpaid', paid_amount: 0 })
      } else if (paymentStatus === 'partial') {
        Object.assign(quotePayload, { payment_status: 'partial', paid_amount: paidAmount })
      } else if (paymentStatus === 'paid') {
        Object.assign(quotePayload, { payment_status: 'paid', paid_amount: paidAmount })
      } else {
        Object.assign(quotePayload, { payment_status: 'closed_partial', paid_amount: paidAmount, closed_payment_note: closedNote.trim(), payment_closed_by: userId })
      }
      // migration 008: include overpayment_note when overpayment confirmed, clear otherwise
      if (isOverpay && overpayChoice === 'yes' && overpaymentNote.trim()) {
        quotePayload.overpayment_note = overpaymentNote.trim()
      } else {
        quotePayload.overpayment_note = ''
      }
    }

    if (selectedStatus === 'rejected') {
      quotePayload.status_note = rejectReason === 'אחר' ? rejectOther.trim() : rejectReason
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbErr } = await (supabase.from('quotes').update(quotePayload as any).eq('id', quoteId))
    if (dbErr) {
      setSaveError(`שגיאה: ${dbErr.message}`)
      setSaving(false)
      return
    }
    if (approvalFile) {
      const fd = new FormData()
      fd.append('file', approvalFile)
      if (approvalNote.trim()) fd.append('note', approvalNote.trim())
      await fetch(`/api/quotes/${quoteId}/approvals`, { method: 'POST', body: fd })
      setApprovalFile(null)
      setApprovalNote('')
    }
    setSaving(false)
    setStep('idle')
    router.refresh()
  }

  const handleArchive = async () => {
    setWorking(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('quotes').update({ status: 'archived' as any }).eq('id', quoteId)
    router.refresh()
  }

  const handleRestore = async () => {
    setWorking(true)
    const supabase = createClient()
    await supabase.from('quotes').update({ status: 'draft' }).eq('id', quoteId)
    router.refresh()
  }

  const handlePermanentDelete = async () => {
    setWorking(true)
    const supabase = createClient()
    const { data: itemRows } = await supabase.from('quote_items').select('id').eq('quote_id', quoteId)
    const itemIds = (itemRows ?? []).map((r) => r.id)
    if (itemIds.length > 0) {
      const { data: imgRows } = await supabase.from('item_images').select('storage_path').in('item_id', itemIds)
      const paths = (imgRows ?? []).map((r) => r.storage_path)
      if (paths.length > 0) await supabase.storage.from('quote-images').remove(paths)
    }
    await supabase.from('quotes').delete().eq('id', quoteId)
    router.refresh()
  }

  const handleSharePdf = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setShareState('loading')
    const result = await shareQuotePdf(quoteId, quoteNumber, companyName)
    if (result.status === 'fallback') {
      setShareState('unsupported')
      setTimeout(() => setShareState('idle'), 3500)
    } else if (result.status === 'error') {
      setShareState('error')
      setTimeout(() => setShareState('idle'), 2500)
    } else {
      setShareState('idle')
    }
  }

  // ── Update status panel ───────────────────────────────────────────────────
  if (step === 'update-status') {
    const saveButtonLabel = saving
      ? ((!isAdmin && hasPaymentData) ? 'שולח...' : 'שומר...')
      : (showOverpayDialog && overpayChoice === 'yes')
        ? (isAdmin ? 'אשר ושמור' : 'שלח לבדיקה')
        : (!isAdmin && hasPaymentData)
          ? 'שלח לבדיקה'
          : 'שמור'

    return (
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 rounded-b-2xl">
        {/* Status buttons */}
        <div className="mb-3">
          <p className="text-xs text-gray-500 font-medium mb-1.5">סטטוס הצעה</p>
          <div className="flex gap-1.5 flex-wrap">
            {ACTIVE_STATUSES.map((s) => (
              <button key={s} type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleStatusSelect(s) }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  s === selectedStatus ? STATUS_COLORS[s] : 'bg-white border border-gray-200 text-gray-500 active:bg-gray-100'
                }`}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Rejection reason */}
        {selectedStatus === 'rejected' && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 font-medium mb-1.5">
              סיבת דחייה <span className="text-red-400">*</span>
            </p>
            <div className="flex flex-col gap-1">
              {REJECT_REASONS.map((r) => (
                <button key={r} type="button"
                  onClick={(e) => { e.stopPropagation(); setRejectReason(r) }}
                  className={`text-xs px-3 py-2 rounded-xl text-right transition-colors ${
                    r === rejectReason
                      ? 'bg-red-50 border border-red-300 text-red-700 font-medium'
                      : 'bg-white border border-gray-200 text-gray-600 active:bg-gray-50'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
            {rejectReason === 'אחר' && (
              <input
                type="text"
                value={rejectOther}
                onChange={(e) => { e.stopPropagation(); setRejectOther(e.target.value) }}
                placeholder="פרט..."
                className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            )}
          </div>
        )}

        {/* Payment section */}
        {selectedStatus === 'accepted' && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 font-medium mb-1.5">סטטוס תשלום</p>
            <div className="flex gap-1.5 flex-wrap">
              {PAYMENT_STATUS_ORDER.map((s) => (
                <button key={s} type="button"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); handlePaymentSelect(s) }}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    s === paymentStatus ? PAYMENT_STATUS_COLORS[s] : 'bg-white border border-gray-200 text-gray-500 active:bg-gray-100'
                  }`}>
                  {PAYMENT_STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {(paymentStatus === 'partial' || paymentStatus === 'closed_partial' || paymentStatus === 'paid') && (
              <input
                type="number" min="0" step="0.01" value={paidAmountStr}
                onChange={(e) => {
                  e.stopPropagation()
                  setPaidAmountStr(e.target.value)
                  setSaveError('')
                  resetOverpayDialog()
                }}
                placeholder="סכום ששולם (₪)"
                className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            )}
            {paymentStatus === 'partial' && paidAmount > 0 && balance > 0 && !isOverpay && (
              <p className="text-xs text-orange-600 mt-1">יתרה: {formatCurrency(balance)}</p>
            )}
            {paymentStatus === 'closed_partial' && (
              <input
                type="text" value={closedNote}
                onChange={(e) => { e.stopPropagation(); setClosedNote(e.target.value); setSaveError('') }}
                placeholder="סיבת סגירה / קיזוז *"
                className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            )}
            {paymentStatus === 'paid' && paidAmount === totalAmount && (
              <p className="text-xs text-green-600 mt-1">{totalFormatted} שולם במלואו ✓</p>
            )}

            {/* Overpay dialog */}
            {showOverpayDialog && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-medium text-amber-900">
                  הסכום ששולם ({formatCurrency(paidAmount)}) גבוה מסכום ההצעה ({formatCurrency(totalAmount)}).
                  האם קיימים חריגים / תוספות שאושרו?
                </p>
                {overpayChoice === null && (
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setOverpayChoice('no') }}
                      className="flex-1 py-2 border border-gray-300 rounded-xl text-xs font-medium text-gray-700 bg-white active:bg-gray-50">
                      לא
                    </button>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setOverpayChoice('yes') }}
                      className="flex-1 py-2 bg-orange-600 text-white rounded-xl text-xs font-semibold active:bg-orange-700">
                      כן
                    </button>
                  </div>
                )}
                {overpayChoice === 'no' && (
                  <p className="text-xs text-red-700 font-medium">
                    לא ניתן לשמור סכום גבוה מסכום ההצעה ללא פירוט חריגים.
                  </p>
                )}
                {overpayChoice === 'yes' && (
                  <input
                    type="text"
                    value={overpaymentNote}
                    onChange={(e) => { e.stopPropagation(); setOverpaymentNote(e.target.value); setSaveError('') }}
                    placeholder="פירוט חריגים / תוספות *"
                    className="w-full border border-amber-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Approval file upload */}
        {selectedStatus === 'accepted' && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 font-medium mb-1.5">אסמכתא אישור (אופציונלי)</p>
            <input
              ref={approvalInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) { setApprovalFile(f); e.target.value = '' }
              }}
            />
            {approvalFile ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <span className="text-xs text-green-700 flex-1 truncate">{approvalFile.name}</span>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); setApprovalFile(null) }}
                  className="text-xs text-gray-400 shrink-0">✕</button>
              </div>
            ) : (
              <button type="button"
                onClick={(e) => { e.stopPropagation(); approvalInputRef.current?.click() }}
                className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 active:bg-gray-50">
                + צרף קובץ
              </button>
            )}
            {approvalFile && (
              <input
                type="text"
                value={approvalNote}
                onChange={(e) => { e.stopPropagation(); setApprovalNote(e.target.value) }}
                placeholder="הערה לאסמכתא (אופציונלי)"
                className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            )}
          </div>
        )}

        {saveError && <p className="text-xs text-red-500 mb-2">{saveError}</p>}

        <div className="flex gap-2">
          <button type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setStep('idle') }}
            disabled={saving}
            className="flex-1 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 bg-white disabled:opacity-50">
            ביטול
          </button>
          {/* Hide save when "no" was chosen for overpay */}
          {!(showOverpayDialog && overpayChoice === 'no') && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleSaveUpdate() }}
              disabled={saving}
              className="flex-1 py-2 bg-orange-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50">
              {saveButtonLabel}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Archive confirm ───────────────────────────────────────────────────────
  if (step === 'confirm-archive') {
    return (
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 rounded-b-2xl">
        <p className="text-xs text-gray-700 font-medium mb-2 text-center">להעביר לארכיון?</p>
        <div className="flex gap-2">
          <button onClick={() => setStep('idle')} disabled={working}
            className="flex-1 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 bg-white disabled:opacity-50">
            ביטול
          </button>
          <button onClick={handleArchive} disabled={working}
            className="flex-1 py-2 bg-gray-700 text-white rounded-xl text-xs font-medium disabled:opacity-50">
            {working ? 'מעביר...' : 'ארכיון'}
          </button>
        </div>
      </div>
    )
  }

  // ── Delete confirm ────────────────────────────────────────────────────────
  if (step === 'confirm-delete') {
    return (
      <div className="border-t border-red-100 bg-red-50 px-4 py-3 rounded-b-2xl">
        <p className="text-xs text-red-700 font-medium mb-2 text-center">מחיקה לצמיתות — פעולה בלתי הפיכה</p>
        <div className="flex gap-2">
          <button onClick={() => setStep('idle')} disabled={working}
            className="flex-1 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 bg-white disabled:opacity-50">
            ביטול
          </button>
          <button onClick={handlePermanentDelete} disabled={working}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-xs font-medium disabled:opacity-50">
            {working ? 'מוחק...' : 'מחק'}
          </button>
        </div>
      </div>
    )
  }

  // ── Idle strip ────────────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50">
      <div className="flex items-center gap-3">
        <a href={`/quotes/${quoteId}/pdf-view`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-gray-400 font-medium active:text-orange-500 transition-colors">
          PDF
        </a>
        {shareState === 'unsupported' ? (
          <span className="text-xs text-gray-400 max-w-[120px] leading-tight">שיתוף נתמך בטלפון בלבד</span>
        ) : (
          <button type="button" onClick={handleSharePdf} disabled={shareState === 'loading'}
            title={shareState === 'error' ? 'שגיאה בהפקת PDF' : 'שתף PDF'}
            className={`transition-colors disabled:opacity-40 ${shareState === 'error' ? 'text-red-400' : 'text-gray-400 active:text-orange-500'}`}
            aria-label="שתף PDF">
            {shareState === 'loading' ? (
              <span className="text-xs text-gray-400">...</span>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {working ? (
          <span className="text-xs text-gray-400">...</span>
        ) : isArchived ? (
          <>
            {canEdit && (
              <button onClick={(e) => { e.stopPropagation(); handleRestore() }}
                className="text-xs text-gray-500 font-medium active:text-gray-700">
                שחזר
              </button>
            )}
            {isAdmin && (
              <button onClick={(e) => { e.stopPropagation(); setStep('confirm-delete') }}
                className="text-xs text-red-400 font-medium active:text-red-600">
                מחק
              </button>
            )}
          </>
        ) : canEdit ? (
          <>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); openUpdatePanel() }}
              className="text-xs text-orange-600 font-medium active:text-orange-800 transition-colors">
              עדכן
            </button>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setStep('confirm-archive') }}
              className="text-xs text-gray-400 font-medium active:text-gray-600 transition-colors">
              ארכיון
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
