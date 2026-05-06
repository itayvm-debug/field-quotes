export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeUserStats } from '@/lib/analytics/compute'
import type { RawQuote, RawProfile } from '@/lib/analytics/compute'
import { AdminUsersPage } from '@/components/AdminUsersPage'

export interface AdminUserRow {
  id: string
  full_name: string
  job_title: string
  role: string
  is_active: boolean
  email: string
  created_at: string
  last_sign_in: string | null
  quoteCount: number
  acceptedCount: number
  paidTotal: number
}

export default async function AdminUsersPageRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const adminClient = createAdminClient()

  const [
    { data: { users: authUsers } },
    profilesResult,
    quotesResult,
  ] = await Promise.all([
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any).from('profiles').select('id, full_name, job_title, role, is_active, created_at'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any).from('quotes').select('*, quote_items(quantity, unit_price)'),
  ])

  const profiles = ((profilesResult.data ?? []) as (RawProfile & { job_title: string; is_active: boolean; created_at: string })[])
  const quotes = ((quotesResult.data ?? []) as RawQuote[])

  const userStats = computeUserStats(quotes, profiles)

  const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  const createdAtMap = new Map(authUsers.map((u) => [u.id, u.created_at]))
  const lastSignInMap = new Map(authUsers.map((u) => [u.id, u.last_sign_in_at ?? null]))

  const rows: AdminUserRow[] = profiles.map((p) => {
    const stats = userStats.find((s) => s.userId === p.id)
    return {
      id: p.id,
      full_name: p.full_name ?? '',
      job_title: p.job_title ?? '',
      role: p.role ?? 'user',
      is_active: p.is_active !== false,
      email: emailMap.get(p.id) ?? '',
      created_at: createdAtMap.get(p.id) ?? p.created_at ?? '',
      last_sign_in: lastSignInMap.get(p.id) ?? null,
      quoteCount: stats?.total ?? 0,
      acceptedCount: stats?.accepted ?? 0,
      paidTotal: stats?.paidTotal ?? 0,
    }
  }).sort((a, b) => a.full_name.localeCompare(b.full_name, 'he'))

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <main className="px-4 py-6 max-w-6xl mx-auto">
        <AdminUsersPage users={rows} />
      </main>
    </div>
  )
}
