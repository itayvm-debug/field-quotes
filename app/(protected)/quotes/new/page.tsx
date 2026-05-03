import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuoteForm } from '@/components/QuoteForm'

export default async function NewQuotePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Pre-fill defaults from company_settings
  const { data: settings } = await supabase
    .from('company_settings')
    .select('default_payment_terms, default_exclusions')
    .single()

  return (
    <QuoteForm
      mode="create"
      userId={user.id}
      initialHeader={{
        payment_terms: settings?.default_payment_terms ?? '',
        exclusions: settings?.default_exclusions ?? '',
      }}
    />
  )
}
