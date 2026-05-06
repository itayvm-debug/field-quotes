import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CompanySettingsForm } from '@/components/CompanySettingsForm'

export default async function CompanySettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: settings } = await supabase
    .from('company_settings')
    .select('*')
    .single()

  if (!settings) redirect('/dashboard')

  let logoUrl: string | null = null
  if (settings.logo_storage_path) {
    const { data: urlData } = await supabase.storage
      .from('company-assets')
      .createSignedUrl(settings.logo_storage_path, 3600)
    logoUrl = urlData?.signedUrl ?? null
  }

  const initial = {
    company_name: settings.company_name,
    company_id_number: settings.company_id_number,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    logo_storage_path: settings.logo_storage_path,
    footer_text: settings.footer_text,
    default_payment_terms: settings.default_payment_terms,
    default_exclusions: settings.default_exclusions,
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8" dir="rtl">
      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900">הגדרות חברה</h1>
      </div>

      <main className="px-4 py-4 max-w-2xl mx-auto">
        <CompanySettingsForm initial={initial} logoUrl={logoUrl} />
      </main>
    </div>
  )
}
