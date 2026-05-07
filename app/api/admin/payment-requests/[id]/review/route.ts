import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: requestId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { action, admin_note } = body

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Fetch the pending request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: request, error: fetchErr } = await (adminClient as any)
    .from('payment_update_requests')
    .select('*')
    .eq('id', requestId)
    .eq('request_status', 'pending')
    .single()

  if (fetchErr || !request) {
    return NextResponse.json({ error: 'Request not found or already reviewed' }, { status: 404 })
  }

  const now = new Date().toISOString()

  if (action === 'approve') {
    // Update the quote's payment fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotePayload: Record<string, any> = {
      payment_status: request.requested_payment_status,
      paid_amount: request.requested_paid_amount,
      overpayment_note: request.requested_overpayment_note ?? '',
    }
    if (request.requested_payment_status === 'closed_partial') {
      quotePayload.closed_payment_note = request.requested_closed_payment_note ?? ''
      quotePayload.payment_closed_by = request.requested_by
    } else {
      quotePayload.closed_payment_note = ''
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: quoteErr } = await (adminClient as any)
      .from('quotes')
      .update(quotePayload)
      .eq('id', request.quote_id)

    if (quoteErr) return NextResponse.json({ error: quoteErr.message }, { status: 500 })
  }

  // Update the request status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (adminClient as any)
    .from('payment_update_requests')
    .update({
      request_status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: now,
      admin_note: (admin_note ?? '').trim(),
    })
    .eq('id', requestId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
