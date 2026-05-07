import { createClient } from '@/lib/supabase/server'
import { AppHeaderClient } from '@/components/AppHeaderClient'

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
  if (isAdmin) {
    const [supportResult, paymentResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('support_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('payment_update_requests')
        .select('id', { count: 'exact', head: true })
        .eq('request_status', 'pending'),
    ])
    openRequestCount = supportResult.count ?? 0
    pendingPaymentCount = paymentResult.count ?? 0
  }

  return (
    <AppHeaderClient
      isAdmin={isAdmin}
      logoUrl={logoUrl}
      openRequestCount={openRequestCount}
      pendingPaymentCount={pendingPaymentCount}
    />
  )
}
