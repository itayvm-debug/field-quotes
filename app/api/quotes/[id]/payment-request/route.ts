import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: quoteId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'admin') {
    return NextResponse.json({ error: 'Admin should update quotes directly' }, { status: 400 })
  }

  // Verify the user owns this quote
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote } = await (supabase as any)
    .from('quotes')
    .select('user_id, status')
    .eq('id', quoteId)
    .single()

  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  if (quote.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (quote.status !== 'accepted') {
    return NextResponse.json({ error: 'ניתן לשלוח בקשת תשלום רק להצעות מאושרות' }, { status: 400 })
  }

  const body = await req.json()
  const {
    requested_payment_status,
    requested_paid_amount,
    requested_closed_payment_note,
    requested_overpayment_note,
    requester_note,
  } = body

  const validStatuses = ['unpaid', 'partial', 'paid', 'closed_partial']
  if (!validStatuses.includes(requested_payment_status)) {
    return NextResponse.json({ error: 'סטטוס תשלום לא תקין' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Check for existing pending request — use admin client to bypass RLS UPDATE restriction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (adminClient as any)
    .from('payment_update_requests')
    .select('id')
    .eq('quote_id', quoteId)
    .eq('request_status', 'pending')
    .single()

  const payload = {
    quote_id: quoteId,
    requested_by: user.id,
    requested_payment_status,
    requested_paid_amount: parseFloat(requested_paid_amount) || 0,
    requested_closed_payment_note: requested_closed_payment_note?.trim() ?? '',
    requested_overpayment_note: requested_overpayment_note?.trim() ?? '',
    requester_note: requester_note?.trim() ?? '',
    request_status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    admin_note: '',
  }

  if (existing) {
    // Update existing pending request via admin client (RLS UPDATE is admin-only)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (adminClient as any)
      .from('payment_update_requests')
      .update({
        requested_payment_status: payload.requested_payment_status,
        requested_paid_amount: payload.requested_paid_amount,
        requested_closed_payment_note: payload.requested_closed_payment_note,
        requested_overpayment_note: payload.requested_overpayment_note,
        requester_note: payload.requester_note,
        requested_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, updated: true })
  }

  // Insert new request via user client (RLS INSERT allows quote owner)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (supabase as any)
    .from('payment_update_requests')
    .insert(payload)

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'כבר קיימת בקשת תשלום שממתינה לאישור אדמין' }, { status: 409 })
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, updated: false })
}
