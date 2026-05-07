'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/calculations'
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from '@/types'

interface PaymentRequest {
  id: string
  quote_id: string
  requested_at: string
  requested_payment_status: string
  requested_paid_amount: number
  requested_closed_payment_note: string
  requested_overpayment_note: string
  requester_note: string
  quote: { quote_number: string | null; client_name: string; user_id: string } | null
  requester: { full_name: string } | null
}

interface Props {
  requests: PaymentRequest[]
}

export function AdminPaymentRequestsPage({ requests: initialRequests }: Props) {
  const router = useRouter()
  const [requests, setRequests] = useState(initialRequests)
  const [processing, setProcessing] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [showRejectInput, setShowRejectInput] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleReview = async (requestId: string, action: 'approve' | 'reject') => {
    const adminNote = adminNotes[requestId] ?? ''
    if (action === 'reject' && !adminNote.trim()) {
      setShowRejectInput((prev) => ({ ...prev, [requestId]: true }))
      return
    }

    setProcessing(requestId)
    setErrors((prev) => ({ ...prev, [requestId]: '' }))

    const res = await fetch(`/api/admin/payment-requests/${requestId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, admin_note: adminNote }),
    })

    if (res.ok) {
      setRequests((prev) => prev.filter((r) => r.id !== requestId))
      router.refresh()
    } else {
      const data = await res.json()
      setErrors((prev) => ({ ...prev, [requestId]: data.error ?? 'שגיאה' }))
    }
    setProcessing(null)
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-lg">אין בקשות תשלום ממתינות</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => {
        const isProcessing = processing === req.id
        const showReject = showRejectInput[req.id]
        const error = errors[req.id]

        return (
          <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {req.quote?.client_name || '(ללא שם לקוח)'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {req.quote?.quote_number ?? '—'}
                  {req.requester?.full_name ? ` · ${req.requester.full_name}` : ''}
                  {' · '}
                  {new Date(req.requested_at).toLocaleDateString('he-IL', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
              <a
                href={`/quotes/${req.quote_id}`}
                className="text-xs text-orange-600 font-medium shrink-0"
              >
                צפה בהצעה ←
              </a>
            </div>

            {/* Requested changes */}
            <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-900">
                  {PAYMENT_STATUS_LABELS[req.requested_payment_status as PaymentStatus] ?? req.requested_payment_status}
                </span>
                <span className="text-xs text-gray-500">סטטוס מבוקש</span>
              </div>
              {req.requested_paid_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-900">{formatCurrency(req.requested_paid_amount)}</span>
                  <span className="text-xs text-gray-500">סכום ששולם</span>
                </div>
              )}
              {req.requested_closed_payment_note && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 text-xs">{req.requested_closed_payment_note}</span>
                  <span className="text-xs text-gray-500">סיבת סגירה</span>
                </div>
              )}
              {req.requested_overpayment_note && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-700 text-xs">{req.requested_overpayment_note}</span>
                  <span className="text-xs text-gray-500">חריגים</span>
                </div>
              )}
              {req.requester_note && (
                <div className="pt-1.5 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-0.5">הערת הגשה</p>
                  <p className="text-sm text-gray-700">{req.requester_note}</p>
                </div>
              )}
            </div>

            {/* Reject note input */}
            {showReject && (
              <div className="mb-3">
                <input
                  type="text"
                  value={adminNotes[req.id] ?? ''}
                  onChange={(e) => setAdminNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                  placeholder="סיבת דחייה (חובה)"
                  disabled={isProcessing}
                  className="w-full border border-red-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 disabled:bg-gray-50"
                />
              </div>
            )}

            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleReview(req.id, 'reject')}
                disabled={isProcessing}
                className="flex-1 py-2.5 border border-red-200 bg-red-50 text-red-600 rounded-xl text-sm font-semibold active:bg-red-100 disabled:opacity-50"
              >
                {isProcessing ? '...' : 'דחה'}
              </button>
              <button
                type="button"
                onClick={() => handleReview(req.id, 'approve')}
                disabled={isProcessing}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold active:bg-green-700 disabled:opacity-50"
              >
                {isProcessing ? 'מעבד...' : 'אשר'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
