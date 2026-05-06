export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard'
import type { RawQuote, RawProfile } from '@/lib/analytics/compute'

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: quotesRaw, error: quotesErr }, { data: profilesRaw }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('quotes').select('*, quote_items(quantity, unit_price)').order('quote_date', { ascending: false }),
    supabase.from('profiles').select('id, full_name, role'),
  ])

  if (quotesErr) {
    console.error('[analytics] quotes fetch error:', quotesErr)
  }

  const quotes = (quotesRaw ?? []) as RawQuote[]
  const profiles = (profilesRaw ?? []) as RawProfile[]

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <main className="px-4 py-6 max-w-3xl mx-auto">
        {quotesErr ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <p className="text-red-700 font-medium text-sm">שגיאה בטעינת נתונים</p>
            <p className="text-red-500 text-xs mt-1">{quotesErr.message}</p>
          </div>
        ) : (
          <AnalyticsDashboard quotes={quotes} profiles={profiles} />
        )}
      </main>
    </div>
  )
}
