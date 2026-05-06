import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupportRequestForm } from '@/components/SupportRequestForm'

export default async function SupportNewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const senderName = profile?.full_name ?? ''

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto">
        <h1 className="text-lg font-bold text-gray-900">פנייה לאדמין</h1>
      </div>

      <main className="px-4 py-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          {senderName && (
            <p className="text-sm text-gray-500 mb-4">
              שולח: <span className="font-medium text-gray-700">{senderName}</span>
            </p>
          )}
          <SupportRequestForm userId={user.id} senderName={senderName} />
        </div>
      </main>
    </div>
  )
}
