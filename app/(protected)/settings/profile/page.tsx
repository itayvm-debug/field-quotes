import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/ProfileForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = profileRaw as any

  const fullName: string = profile?.full_name ?? ''
  const jobTitle: string = profile?.job_title ?? ''
  const signaturePath: string | null = profile?.signature_storage_path ?? null

  let signatureUrl: string | null = null
  if (signaturePath) {
    const { data: urlData } = await supabase.storage
      .from('user-signatures')
      .createSignedUrl(signaturePath, 3600)
    signatureUrl = urlData?.signedUrl ?? null
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto">
        <h1 className="text-lg font-bold text-gray-900">פרופיל אישי</h1>
      </div>

      <main className="px-4 py-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <ProfileForm
            userId={user.id}
            initialFullName={fullName}
            initialJobTitle={jobTitle}
            initialSignatureUrl={signatureUrl}
            initialSignaturePath={signaturePath}
          />
        </div>
      </main>
    </div>
  )
}
