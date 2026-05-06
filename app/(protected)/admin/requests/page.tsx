import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminRequestItem } from '@/components/AdminRequestItem'

export default async function AdminRequestsPage() {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: requestsRaw } = await (supabase as any)
    .from('support_requests')
    .select('id, sender_name, subject, message, status, created_at')
    .order('created_at', { ascending: false })

  const requests: Array<{ id: string; sender_name: string; subject: string; message: string; status: string; created_at: string }> = requestsRaw ?? []
  const openCount = requests.filter((r) => r.status === 'open').length

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto flex items-center gap-2">
        <h1 className="text-lg font-bold text-gray-900">פניות משתמשים</h1>
        {openCount > 0 && (
          <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
            {openCount}
          </span>
        )}
      </div>

      <main className="px-4 pb-4 max-w-2xl mx-auto space-y-3">
        {requests.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">אין פניות</p>
          </div>
        ) : (
          requests.map((r) => (
            <AdminRequestItem
              key={r.id}
              id={r.id}
              senderName={r.sender_name}
              subject={r.subject}
              message={r.message}
              status={r.status}
              createdAt={r.created_at}
            />
          ))
        )}
      </main>
    </div>
  )
}
