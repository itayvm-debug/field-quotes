import { redirect } from 'next/navigation'
import Link from 'next/link'
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
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Link href="/dashboard" className="text-gray-500 text-sm font-medium px-1 py-1">
            ← חזור
          </Link>
          <h1 className="text-xl font-bold text-gray-900">הגדרות חברה</h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="px-4 py-4 max-w-2xl mx-auto">
        <CompanySettingsForm initial={initial} logoUrl={logoUrl} />
      </main>
    </div>
  )
}
