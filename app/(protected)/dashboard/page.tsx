import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { calcSubtotal, calcVat, calcTotal, formatCurrency, formatDate } from '@/lib/calculations'
import { STATUS_LABELS, STATUS_COLORS, type QuoteStatus } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, quote_number, client_name, quote_date, status, vat_percentage, quote_items(quantity, unit_price)')
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  async function handleLogout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-gray-900">הצעות מחיר</h1>
            {profile?.full_name && (
              <p className="text-xs text-gray-400 mt-0.5">{profile.full_name}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {profile?.role === 'admin' && (
              <Link
                href="/settings/company"
                className="text-gray-400 text-sm px-2 py-2"
                title="הגדרות חברה"
              >
                ⚙
              </Link>
            )}
            <Link
              href="/quotes/new"
              className="bg-blue-600 text-white rounded-xl px-4 py-2.5 font-semibold text-sm active:bg-blue-700 transition-colors"
            >
              + חדשה
            </Link>
            <form action={handleLogout}>
              <button
                type="submit"
                className="text-gray-400 text-sm px-2 py-2"
              >
                יציאה
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Quote list */}
      <main className="px-4 py-4 max-w-2xl mx-auto space-y-3">
        {!quotes || quotes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">אין הצעות עדיין</p>
            <p className="text-gray-300 text-sm mt-2">לחץ &quot;+ חדשה&quot; כדי להתחיל</p>
          </div>
        ) : (
          quotes.map((quote) => {
            const items = (quote.quote_items ?? []) as Array<{ quantity: number; unit_price: number }>
            const subtotal = calcSubtotal(
              items.map((i) => ({
                tempId: '',
                item_number: 0,
                description: '',
                unit: '',
                notes: '',
                quantity: String(i.quantity),
                unit_price: String(i.unit_price),
              }))
            )
            const vat = calcVat(subtotal, quote.vat_percentage)
            const total = calcTotal(subtotal, vat)

            return (
              <Link
                key={quote.id}
                href={`/quotes/${quote.id}/edit`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">
                        {quote.quote_number ?? '—'}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          STATUS_COLORS[quote.status as QuoteStatus]
                        }`}
                      >
                        {STATUS_LABELS[quote.status as QuoteStatus]}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900 truncate">
                      {quote.client_name || '(ללא שם לקוח)'}
                    </p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {formatDate(quote.quote_date)}
                    </p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="font-bold text-gray-900 text-base">{formatCurrency(total)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {items.length} {items.length === 1 ? 'סעיף' : 'סעיפים'}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </main>
    </div>
  )
}
