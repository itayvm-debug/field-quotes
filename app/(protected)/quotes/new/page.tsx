import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuoteForm } from '@/components/QuoteForm'
import { DEFAULT_EXCLUSIONS } from '@/types'

export default async function NewQuotePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: settings } = await supabase
    .from('company_settings')
    .select('default_payment_terms, default_exclusions, logo_storage_path')
    .single()

  let logoUrl: string | null = null
  if (settings?.logo_storage_path) {
    const { data: logoData } = await supabase.storage
      .from('company-assets').createSignedUrl(settings.logo_storage_path, 3600)
    logoUrl = logoData?.signedUrl ?? null
  }

  return (
    <QuoteForm
      mode="create"
      userId={user.id}
      logoUrl={logoUrl}
      initialHeader={{
        payment_terms: settings?.default_payment_terms ?? '',
        exclusions: settings?.default_exclusions || DEFAULT_EXCLUSIONS,
      }}
    />
  )
}
