import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardFilters } from '@/components/DashboardFilters'
import { DashboardList } from '@/components/DashboardList'

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const { status: statusFilter = '' } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quotesResult, profileResult, settingsResult, allProfilesResult, approvalsResult] = await Promise.all([
    (() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = (supabase as any)
        .from('quotes')
        .select('*, quote_items(quantity, unit_price)')
        .order('created_at', { ascending: false })
      if (statusFilter === 'archived') return q.eq('status', 'archived')
      if (statusFilter) return q.eq('status', statusFilter)
      return q.neq('status', 'archived')
    })(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('company_settings').select('company_name').single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('profiles').select('id, full_name, job_title'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('quote_approvals').select('quote_id'),
  ])

  const companyName = settingsResult.data?.company_name ?? ''
  const userRole = profileResult.data?.role ?? 'user'
  const creatorProfiles: Array<{ id: string; full_name: string; job_title: string }> =
    allProfilesResult.data ?? []
  const approvalQuoteIds = new Set<string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (approvalsResult.data ?? []).map((r: any) => r.quote_id)
  )

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Filter tabs */}
      <div className="bg-white border-b border-gray-100 px-4 py-2.5">
        <div className="max-w-2xl mx-auto">
          <DashboardFilters activeFilter={statusFilter} />
        </div>
      </div>

      <DashboardList
        quotes={quotesResult.data ?? []}
        statusFilter={statusFilter}
        userRole={userRole}
        userId={user.id}
        companyName={companyName}
        creatorProfiles={creatorProfiles}
        approvalQuoteIds={approvalQuoteIds}
      />
    </div>
  )
}
