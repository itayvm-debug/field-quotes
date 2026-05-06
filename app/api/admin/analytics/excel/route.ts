import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { applyFilters, computeKPIs, computeUserStats } from '@/lib/analytics/compute'
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
  const [{ data: quotesRaw, error: qErr }, { data: profilesRaw }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('quotes').select('*, quote_items(quantity, unit_price)'),
    supabase.from('profiles').select('id, full_name, role'),
  ])

  if (qErr) {
    console.error('[analytics/excel] quotes fetch error:', qErr)
    return NextResponse.json({ error: qErr.message }, { status: 500 })
  }

  const allQuotes = (quotesRaw ?? []) as RawQuote[]
  const profiles = (profilesRaw ?? []) as RawProfile[]
  const quotes = applyFilters(allQuotes, opts)

  const kpi = computeKPIs(quotes)
  const userRows = computeUserStats(quotes, profiles)

  const fmtNum = (n: number) => Math.round(n * 100) / 100
  const today = new Date().toISOString().split('T')[0]

  // ── Sheet 1: Summary ───────────────────────────────────────────────────────
  const summaryRows: (string | number)[][] = [
    ['KPIs', ''],
    ['סה"כ הצעות', kpi.totalCount],
    ['מאושרות', kpi.acceptedCount],
    ['שולם', fmtNum(kpi.paidTotal)],
    ['יתרה פתוחה', fmtNum(kpi.openBalance)],
    ['יתרה שנסגרה', fmtNum(kpi.closedAdjustment)],
    ['הצעות עם חריגים', kpi.overpayCount],
    ['סה"כ חריגים / תוספות', fmtNum(kpi.overpayTotal)],
    [],
    [
      'שם',
      'תפקיד',
      'סה"כ',
      'טיוטות',
      'נשלחו',
      'אושרו',
      'נדחו',
      'ארכיון',
      'שווי כולל',
      'שווי מאושר',
      'שולם',
      'יתרה פתוחה',
      'יתרה שנסגרה',
      '% גבייה',
    ],
    ...userRows.map((r) => [
      r.name, r.role,
      r.total, r.draft, r.sent, r.accepted, r.rejected, r.archived,
      fmtNum(r.totalAmount), fmtNum(r.acceptedAmount),
      fmtNum(r.paidTotal), fmtNum(r.openBalance), fmtNum(r.closedAdjustment),
      r.acceptedAmount > 0 ? `${r.collectionPct}%` : '—',
    ]),
  ]

  // ── Sheet 2: Quote details ─────────────────────────────────────────────────
  const { quoteComputedTotal } = await import('@/lib/analytics/compute')
  const detailHeader = ['מספר הצעה', 'לקוח', 'תאריך', 'סטטוס', 'סיבת דחייה', 'סטטוס תשלום', 'שולם', 'יתרה', 'חריגים / תוספות', 'סכום חריגים', 'יוצר']
  const profileMap = new Map<string, RawProfile>(profiles.map((p) => [p.id, p]))
  const detailRows = quotes.map((q) => {
    const total = quoteComputedTotal(q)
    const paid = parseFloat(String(q.paid_amount)) || 0
    return [
      q.quote_number ?? '',
      q.client_name,
      q.quote_date,
      q.status,
      q.status_note ?? '',
      q.payment_status ?? 'unpaid',
      fmtNum(paid),
      fmtNum(total - paid),
      q.overpayment_note ?? '',
      fmtNum(Math.max(0, paid - total)),
      profileMap.get(q.user_id)?.full_name ?? '',
    ]
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'סיכום')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]), 'הצעות')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
  const filename = `field-quotes-report-${today}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
