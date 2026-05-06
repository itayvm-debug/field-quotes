import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { applyFilters, computeKPIs, computeUserStats } from '@/lib/analytics/compute'
import { AnalyticsPDF } from '@/lib/pdf/AnalyticsPDF'
import type { RejectedRow, OverpayRow } from '@/lib/pdf/AnalyticsPDF'
import type { RawQuote, RawProfile } from '@/lib/analytics/compute'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const p = req.nextUrl.searchParams
  const opts = {
    userId: p.get('userId') ?? undefined,
    fromDate: p.get('fromDate') ?? undefined,
    toDate: p.get('toDate') ?? undefined,
    quoteStatus: p.get('quoteStatus') ?? undefined,
    paymentStatus: p.get('paymentStatus') ?? undefined,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: quotesRaw, error: qErr }, { data: profilesRaw }, { data: settingsRaw }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('quotes').select('*, quote_items(quantity, unit_price)'),
    supabase.from('profiles').select('id, full_name, role'),
    supabase.from('company_settings').select('company_name, logo_storage_path').single(),
  ])

  if (qErr) {
    console.error('[analytics/pdf] quotes fetch error:', qErr)
    return NextResponse.json({ error: qErr.message }, { status: 500 })
  }

  const allQuotes = (quotesRaw ?? []) as RawQuote[]
  const profiles = (profilesRaw ?? []) as RawProfile[]
  const quotes = applyFilters(allQuotes, opts)

  const kpi = computeKPIs(quotes)
  const userRows = computeUserStats(quotes, profiles)

  const companyName = (settingsRaw as { company_name: string } | null)?.company_name ?? ''
  const logoStoragePath = (settingsRaw as { logo_storage_path: string | null } | null)?.logo_storage_path ?? null

  let logoUrl: string | null = null
  if (logoStoragePath) {
    const { data } = await supabase.storage.from('company-assets').createSignedUrl(logoStoragePath, 600)
    logoUrl = data?.signedUrl ?? null
  }

  const profileMap = new Map<string, RawProfile>(profiles.map((pr) => [pr.id, pr]))
  const filterUserName = opts.userId ? (profileMap.get(opts.userId)?.full_name ?? opts.userId) : undefined

  const { quoteComputedTotal } = await import('@/lib/analytics/compute')
  const rejectedRows: RejectedRow[] = quotes
    .filter((q) => q.status === 'rejected')
    .map((q) => ({
      quoteNumber: q.quote_number,
      clientName: q.client_name,
      quoteDate: q.quote_date,
      amount: quoteComputedTotal(q),
      statusNote: q.status_note ?? '',
      userName: profileMap.get(q.user_id)?.full_name ?? '',
    }))

  const overpayRows: OverpayRow[] = quotes
    .filter((q) => (q.overpayment_note ?? '') !== '')
    .map((q) => {
      const total = quoteComputedTotal(q)
      const paid = parseFloat(String(q.paid_amount)) || 0
      return {
        quoteNumber: q.quote_number,
        clientName: q.client_name,
        quoteDate: q.quote_date,
        total,
        paid,
        overpaymentNote: q.overpayment_note ?? '',
        userName: profileMap.get(q.user_id)?.full_name ?? '',
      }
    })

  const now = new Date()
  const generatedAt = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`
  const today = now.toISOString().split('T')[0]

  const pdfEl = React.createElement(AnalyticsPDF, { kpi, userRows, logoUrl, companyName, generatedAt, filters: opts, filterUserName, rejectedRows, overpayRows })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = await renderToBuffer(pdfEl as any)
  const filename = `field-quotes-report-${today}.pdf`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = new Blob([buf as any], { type: 'application/pdf' })
  return new Response(blob, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
