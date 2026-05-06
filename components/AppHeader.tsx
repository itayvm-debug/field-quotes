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
  if (isAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from('support_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
    openRequestCount = count ?? 0
  }

  return (
    <AppHeaderClient
      isAdmin={isAdmin}
      logoUrl={logoUrl}
      openRequestCount={openRequestCount}
    />
  )
}
