import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppHeaderClient } from '@/components/AppHeaderClient'
import { isoHoursAgo } from '@/lib/dates'

export async function AppHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('company_settings').select('company_name, logo_storage_path').single(),
  ])

  const isAdmin = profile?.role === 'admin'

  let logoUrl: string | null = null
  if (settings?.logo_storage_path) {
    const { data } = await supabase.storage
      .from('company-assets')
      .createSignedUrl(settings.logo_storage_path, 3600)
    logoUrl = data?.signedUrl ?? null
  }

  let openRequestCount = 0
  let pendingPaymentCount = 0
  let recentErrorCount = 0
  if (isAdmin) {
    const dayAgo = isoHoursAgo(24)
    const [supportResult, paymentResult, errorsResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('support_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
      // RLS restricts SELECT to the requester — admin client needed for badge count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (createAdminClient() as any)
        .from('payment_update_requests')
        .select('id', { count: 'exact', head: true })
        .eq('request_status', 'pending'),
      // Errors logged in the last 24h (RLS: admins only)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('app_errors')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', dayAgo),
    ])
    openRequestCount = supportResult.count ?? 0
    pendingPaymentCount = paymentResult.count ?? 0
    recentErrorCount = errorsResult.count ?? 0
  }

  return (
    <AppHeaderClient
      isAdmin={isAdmin}
      logoUrl={logoUrl}
      openRequestCount={openRequestCount}
      pendingPaymentCount={pendingPaymentCount}
      recentErrorCount={recentErrorCount}
    />
  )
}
