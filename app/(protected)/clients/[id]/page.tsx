import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { quoteTotal, type TotalsItem } from '@/lib/quoteTotals'
import { formatCurrency, formatDate } from '@/lib/calculations'
import { formatRevisionNumber } from '@/lib/revisionNumber'
import { STATUS_LABELS, STATUS_COLORS, type QuoteStatus } from '@/types'
import { ClientEditor } from '@/components/ClientEditor'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [{ data: profile }, { data: client }, { data: quotesRaw }, { data: allClients }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    (supabase as any).from('clients').select('id, name, contact, email, notes, alias_keys').eq('id', id).maybeSingle(),
    (supabase as any)
      .from('quotes')
      .select('id, quote_number, revision_number, status, quote_date, client_address, project_description, pricing_mode, manual_total, price_adjustments, vat_percentage, quote_items(quantity, unit_price, is_optional)')
      .eq('client_id', id)
      .order('quote_date', { ascending: false }),
    (supabase as any).from('clients').select('id, name').neq('id', id).order('name'),
  ])
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (!client) notFound()

  const role = profile?.role ?? 'user'
  type QuoteRow = {
    id: string; quote_number: string | null; revision_number: number | null; status: string
    quote_date: string; client_address: string | null; project_description: string | null
    pricing_mode: string | null; manual_total: number | null; price_adjustments: unknown
    vat_percentage: number | null; quote_items: TotalsItem[] | null
  }
  const quotes = ((quotesRaw ?? []) as QuoteRow[]).map((q) => ({
    ...q,
    total: quoteTotal(q, q.quote_items ?? []),
  }))
  const active = quotes.filter((q) => q.status !== 'archived')
  const accepted = active.filter((q) => q.status === 'accepted')
  const rejected = active.filter((q) => q.status === 'rejected')
  const decided = accepted.length + rejected.length
  const winRate = decided > 0 ? Math.round((accepted.length / decided) * 100) : null
  const sum = (arr: typeof quotes) => arr.reduce((s, q) => s + q.total, 0)

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto">
        <Link href="/clients" className="text-sm text-gray-500">→ לכל הלקוחות</Link>
        <h1 className="text-lg font-bold text-gray-900 mt-2">{client.name}</h1>
      </div>

      <main className="px-4 pb-6 max-w-2xl mx-auto space-y-4">
        <section className="grid grid-cols-3 gap-2">
          <Stat label="הצעות" value={String(active.length)} />
          <Stat label="אושרו" value={String(accepted.length)} sub={accepted.length ? formatCurrency(sum(accepted)) : undefined} />
          <Stat label="אחוז זכייה" value={winRate == null ? '—' : `${winRate}%`} sub={decided ? `${decided} הוכרעו` : 'אין הכרעות'} />
        </section>

        <ClientEditor
          client={{
            id: client.id, name: client.name, contact: client.contact ?? '',
            email: client.email ?? '', notes: client.notes ?? '', aliases: client.alias_keys ?? [],
          }}
          canEdit={role !== 'viewer'}
          isAdmin={role === 'admin'}
          otherClients={(allClients ?? []) as Array<{ id: string; name: string }>}
        />

        <section className="space-y-2">
          <h2 className="font-semibold text-gray-700">הצעות מחיר</h2>
          {quotes.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl border border-gray-100 p-4 text-center">אין הצעות ללקוח זה</p>
          ) : (
            quotes.map((q) => {
              const status = q.status as QuoteStatus
              return (
                <Link
                  key={q.id}
                  href={`/quotes/${q.id}`}
                  className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-3 active:bg-gray-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[status] ?? status}
                      </span>
                      <span className="text-xs font-mono text-gray-500" dir="ltr">
                        {q.quote_number ?? '—'} · {formatRevisionNumber(q.revision_number)}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(q.total)}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 truncate">
                    {q.client_address || q.project_description || ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(q.quote_date)}</p>
                </Link>
              )
            })
          )}
        </section>
      </main>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
