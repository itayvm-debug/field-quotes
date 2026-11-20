import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { quoteTotal, type TotalsItem } from '@/lib/quoteTotals'
import { ClientsList, type ClientRow } from '@/components/ClientsList'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [{ data: clientsRaw }, { data: quotesRaw }] = await Promise.all([
    (supabase as any).from('clients').select('id, name, contact').order('name'),
    // RLS: users see their own quotes; admin/manager/viewer see all
    (supabase as any)
      .from('quotes')
      .select('id, client_id, status, quote_date, pricing_mode, manual_total, price_adjustments, vat_percentage, quote_items(quantity, unit_price, is_optional)'),
  ])
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const stats = new Map<string, { count: number; accepted: number; open: number; total: number; acceptedTotal: number; last: string | null }>()
  for (const q of (quotesRaw ?? []) as Array<Record<string, unknown>>) {
    const cid = q.client_id as string | null
    if (!cid || q.status === 'archived') continue
    const s = stats.get(cid) ?? { count: 0, accepted: 0, open: 0, total: 0, acceptedTotal: 0, last: null }
    const total = quoteTotal(q, (q.quote_items ?? []) as TotalsItem[])
    s.count++
    s.total += total
    if (q.status === 'accepted') { s.accepted++; s.acceptedTotal += total }
    if (q.status === 'sent' || q.status === 'draft') s.open++
    const d = q.quote_date as string | null
    if (d && (!s.last || d > s.last)) s.last = d
    stats.set(cid, s)
  }

  const rows: ClientRow[] = ((clientsRaw ?? []) as Array<{ id: string; name: string; contact: string }>).map((c) => {
    const s = stats.get(c.id)
    return {
      id: c.id, name: c.name, contact: c.contact,
      quoteCount: s?.count ?? 0, acceptedCount: s?.accepted ?? 0, openCount: s?.open ?? 0,
      total: s?.total ?? 0, acceptedTotal: s?.acceptedTotal ?? 0, lastDate: s?.last ?? null,
    }
  })

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto flex items-center gap-2">
        <h1 className="text-lg font-bold text-gray-900">לקוחות</h1>
        <span className="text-xs text-gray-400">{rows.length}</span>
      </div>
      <main className="px-4 pb-6 max-w-2xl mx-auto">
        <ClientsList rows={rows} />
      </main>
    </div>
  )
}
