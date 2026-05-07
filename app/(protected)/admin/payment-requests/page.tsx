export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPaymentRequestsPage } from '@/components/AdminPaymentRequestsPage'

export default async function PaymentRequestsAdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: requests } = await (supabase as any)
    .from('payment_update_requests')
    .select(`
      id, quote_id, requested_at,
      requested_payment_status, requested_paid_amount,
      requested_closed_payment_note, requested_overpayment_note,
      requester_note,
      quote:quote_id(quote_number, client_name, user_id),
      requester:requested_by(full_name)
    `)
    .eq('request_status', 'pending')
    .order('requested_at', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="px-4 py-4 max-w-2xl mx-auto">
        <h1 className="text-lg font-bold text-gray-900 mb-4">
          בקשות עדכון תשלום
          {requests?.length > 0 && (
            <span className="mr-2 text-sm font-semibold bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">
              {requests.length}
            </span>
          )}
        </h1>
        <AdminPaymentRequestsPage requests={requests ?? []} />
      </div>
    </div>
  )
}
