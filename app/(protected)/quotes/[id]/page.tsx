export const dynamic = 'force-dynamic'

import React from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcSubtotal, calcVat, calcTotal, formatCurrency, formatDate } from '@/lib/calculations'
import { STATUS_LABELS, STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, type QuoteStatus, type QuoteItemDraft, type PaymentStatus } from '@/types'
import { QuoteActionsPanel } from '@/components/QuoteActionsPanel'
import { QuoteApprovalsPanel } from '@/components/QuoteApprovalsPanel'

import { parseNotes } from '@/lib/notesFormat'

const fixRtlText = (text: string) =>
  text.split('\n').map((line) => (line.trim() ? line + '‏' : line)).join('\n')

function renderBoldHtml(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

function renderFormattedNotes(raw: string): React.ReactNode {
  const paras = parseNotes(raw).filter((p) => p.text.trim())
  if (paras.length === 0) return null
  return paras.map((para, i) => (
    <React.Fragment key={i}>
      {i > 0 && '\n'}
      {para.bold ? <strong>{para.text}</strong> : para.text}
    </React.Fragment>
  ))
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function QuoteViewPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: quote }, { data: profile }, { data: settings }] = await Promise.all([
    supabase
      .from('quotes')
      .select('*, quote_items(*, item_images(id, storage_path, include_in_pdf, display_order, caption))')
      .eq('id', id)
      .single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('company_settings').select('company_name').single(),
  ])

  if (!quote) notFound()

  const userRole = profile?.role ?? 'user'
  const companyName = settings?.company_name ?? ''

  // Creator profile for signature
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creatorUserId: string | null = (quote as any).user_id ?? null
  let creatorName = ''
  let creatorJobTitle = ''
  let creatorSignatureUrl: string | null = null

  if (creatorUserId) {
    const { data: creatorRaw } = await supabase.from('profiles').select('*').eq('id', creatorUserId).single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cp = creatorRaw as any
    if (cp) {
      creatorName = cp.full_name ?? ''
      creatorJobTitle = cp.job_title ?? ''
      if (cp.signature_storage_path) {
        const { data: sigData } = await supabase.storage
          .from('user-signatures')
          .createSignedUrl(cp.signature_storage_path, 3600)
        creatorSignatureUrl = sigData?.signedUrl ?? null
      }
    }
  }

  // Payment + status fields (migration 007/008)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = quote as any
  const paymentStatus = (q.payment_status ?? 'unpaid') as PaymentStatus
  const paidAmount = parseFloat(q.paid_amount ?? 0)
  const closedPaymentNote = (q.closed_payment_note ?? '') as string
  const paymentClosedAt = (q.payment_closed_at ?? null) as string | null
  const paymentClosedBy = (q.payment_closed_by ?? null) as string | null
  const statusNote = (q.status_note ?? '') as string
  const overpaymentNote = (q.overpayment_note ?? '') as string

  let paymentClosedByName: string | null = null
  if (paymentClosedBy) {
    const { data: closer } = await supabase
      .from('profiles').select('full_name').eq('id', paymentClosedBy).single()
    paymentClosedByName = closer?.full_name || null
  }

  // Fetch pending payment request via admin client — RLS on payment_update_requests
  // restricts SELECT to the requester only, so the user-session client returns null for admins.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingRequest } = await (createAdminClient() as any)
    .from('payment_update_requests')
    .select('id, requested_payment_status, requested_paid_amount, requested_closed_payment_note, requested_overpayment_note, requester_note, requested_at')
    .eq('quote_id', id)
    .eq('request_status', 'pending')
    .maybeSingle()

  const sortedItems = ((quote.quote_items ?? []) as Array<{
    id: string; item_number: number; description: string; unit: string
    quantity: number; unit_price: number; notes: string; is_optional?: boolean
    item_images: Array<{ id: string; storage_path: string; include_in_pdf: boolean; display_order: number; caption: string }>
  }>).sort((a, b) => a.item_number - b.item_number)

  const itemsWithImages = await Promise.all(
    sortedItems.map(async (item) => {
      const images = [...item.item_images].sort((a, b) => a.display_order - b.display_order)
      const withUrls = await Promise.all(
        images.map(async (img) => {
          const { data: urlData } = await supabase.storage
            .from('quote-images').createSignedUrl(img.storage_path, 3600)
          return { ...img, signedUrl: urlData?.signedUrl ?? '' }
        })
      )
      return { ...item, images: withUrls }
    })
  )

  const draftItems: QuoteItemDraft[] = sortedItems.map((i) => ({
    tempId: i.id, item_number: i.item_number, description: i.description,
    unit: i.unit, notes: i.notes, quantity: String(i.quantity), unit_price: String(i.unit_price),
    is_optional: i.is_optional,
  }))
  const subtotal = calcSubtotal(draftItems)
  const vat = calcVat(subtotal, quote.vat_percentage)
  const total = calcTotal(subtotal, vat)
  const totalFormatted = formatCurrency(total)
  const quoteStatus = quote.status as QuoteStatus

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <main className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        {/* Quote identity */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[quoteStatus]}`}>
              {STATUS_LABELS[quoteStatus]}
            </span>
            {quoteStatus === 'accepted' && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${overpaymentNote ? 'bg-amber-100 text-amber-700' : PAYMENT_STATUS_COLORS[paymentStatus]}`}>
                {overpaymentNote
                  ? (paymentStatus === 'paid' ? 'שולם כולל חריגים' : 'שולם חלקית כולל חריגים')
                  : PAYMENT_STATUS_LABELS[paymentStatus]}
              </span>
            )}
            <span className="text-xs font-mono text-gray-400 ms-auto">{quote.quote_number ?? '—'}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            {quote.client_name || '(ללא שם לקוח)'}
          </h1>
          {quote.client_address && <p className="text-sm text-gray-500">{quote.client_address}</p>}
          {quote.client_contact && <p className="text-sm text-gray-500 mt-0.5">{quote.client_contact}</p>}
          <div className="flex gap-4 text-xs text-gray-400 mt-3">
            <span>תאריך: {formatDate(quote.quote_date)}</span>
            {quote.valid_until && <span>בתוקף עד: {formatDate(quote.valid_until)}</span>}
          </div>
          {quote.project_description && (
            <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">
              {quote.project_description}
            </p>
          )}
          {quoteStatus === 'rejected' && statusNote && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">סיבת דחייה</p>
              <p className="text-sm text-red-600 font-medium">{statusNote}</p>
            </div>
          )}
        </section>

        {/* Items */}
        {itemsWithImages.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-gray-700">סעיפים ({itemsWithImages.length})</h2>
            {itemsWithImages.map((item) => (
              <div key={item.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${(item as {is_optional?: boolean}).is_optional ? 'border-amber-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className="text-gray-400 text-xs font-mono">{item.item_number}.</span>
                      {(item as {is_optional?: boolean}).is_optional && (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                          אופציה
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900">{item.description ? renderBoldHtml(item.description) : '(ללא תיאור)'}</p>
                    {item.notes && (
                      <p className="text-xs text-gray-400 mt-1 whitespace-pre-line">
                        {renderFormattedNotes(item.notes)}
                      </p>
                    )}
                  </div>
                  <div className="text-left shrink-0">
                    <p className={`font-semibold text-sm ${(item as {is_optional?: boolean}).is_optional ? 'text-gray-400' : 'text-gray-900'}`}>
                      {formatCurrency(item.quantity * item.unit_price)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
                    </p>
                    {(item as {is_optional?: boolean}).is_optional && (
                      <p className="text-xs text-amber-500 mt-0.5">לא בסה״כ</p>
                    )}
                  </div>
                </div>
                {item.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {item.images.map((img) =>
                      img.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={img.id} src={img.signedUrl} alt={img.caption || ''} loading="lazy"
                          className="w-full aspect-square object-cover rounded-xl border border-gray-100" />
                      ) : null
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Financial summary */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>סה״כ לפני מע״מ</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>מע״מ {quote.vat_percentage}%</span>
              <span>{formatCurrency(vat)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2">
              <span>{quote.vat_percentage > 0 ? 'סה״כ כולל מע״מ' : 'סה״כ'}</span>
              <span>{totalFormatted}</span>
            </div>
            {draftItems.some((i) => i.is_optional) && (
              <p className="text-xs text-amber-600 pt-2 border-t border-gray-100 mt-1">
                * סעיפי אופציה אינם כלולים בסה״כ
              </p>
            )}
            {quoteStatus === 'accepted' && paidAmount > 0 && (
              <div className="pt-2 border-t border-gray-100 space-y-1.5 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">שולם בפועל</span>
                  <span className={`font-medium ${paidAmount > total ? 'text-amber-600' : 'text-green-600'}`}>
                    {formatCurrency(paidAmount)}
                  </span>
                </div>
                {paidAmount < total && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">יתרה לתשלום</span>
                    <span className="font-medium text-orange-600">{formatCurrency(total - paidAmount)}</span>
                  </div>
                )}
                {overpaymentNote && (
                  <div className="pt-1">
                    <p className="text-xs text-gray-400 mb-0.5">חריגים / תוספות</p>
                    <p className="text-sm text-amber-700 font-medium">{overpaymentNote}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Terms */}
        {(quote.payment_terms || quote.exclusions) && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3 text-sm text-gray-600">
            {quote.payment_terms && (
              <div>
                <p className="text-xs text-gray-400 mb-1">תנאי תשלום</p>
                <p dir="rtl">{fixRtlText(quote.payment_terms)}</p>
              </div>
            )}
            {quote.exclusions && (
              <div>
                <p className="text-xs text-gray-400 mb-1">החרגות והערות</p>
                <p className="whitespace-pre-line" dir="rtl">{fixRtlText(quote.exclusions)}</p>
              </div>
            )}
          </section>
        )}

        {/* Creator signature */}
        {creatorName && quoteStatus !== 'draft' && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            {creatorSignatureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={creatorSignatureUrl} alt="חתימה" className="h-12 object-contain mb-2" />
            )}
            <p className="text-xs text-gray-400" dir="rtl">{'בברכה,‏'}</p>
            <p className="text-sm font-semibold text-gray-900">
              {creatorName}{creatorJobTitle ? ` - ${creatorJobTitle}` : ''}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{companyName}</p>
          </section>
        )}

        {/* PDF + Edit bottom buttons */}
        <div className="flex gap-3">
          <Link
            href={`/quotes/${id}/pdf-view`}
            className="flex-1 text-center py-3.5 border border-gray-200 rounded-2xl text-gray-700 font-semibold text-sm active:bg-gray-50 bg-white"
          >
            צפה ב-PDF
          </Link>
          {(userRole === 'admin' || userRole === 'manager' || userRole === 'user') && (
            <Link
              href={`/quotes/${id}/edit`}
              className="flex-1 text-center py-3.5 bg-orange-600 text-white rounded-2xl font-semibold text-sm active:bg-orange-700"
            >
              ערוך הצעה
            </Link>
          )}
        </div>

        {/* Approvals panel — accepted quotes only */}
        {quoteStatus === 'accepted' && (
          <QuoteApprovalsPanel quoteId={id} isAdmin={userRole === 'admin'} />
        )}

        {/* Combined status + payment + share + archive */}
        <QuoteActionsPanel
          quoteId={id}
          quoteNumber={quote.quote_number}
          clientName={quote.client_name}
          totalAmount={total}
          currentStatus={quote.status}
          userRole={userRole}
          userId={user.id}
          companyName={companyName}
          initialPaymentStatus={paymentStatus}
          initialPaidAmount={paidAmount}
          initialClosedPaymentNote={closedPaymentNote}
          initialPaymentClosedAt={paymentClosedAt}
          paymentClosedByName={paymentClosedByName}
          initialStatusNote={statusNote}
          initialOverpaymentNote={overpaymentNote}
          pendingPaymentRequest={pendingRequest ?? null}
        />
      </main>
    </div>
  )
}
