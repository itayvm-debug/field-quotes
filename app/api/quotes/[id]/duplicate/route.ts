import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayIso, addDaysIso, daysBetweenIso } from '@/lib/dates'

export const dynamic = 'force-dynamic'

// POST /api/quotes/[id]/duplicate
// Creates a new draft quote (new number, today's date, VER00) owned by the
// current user, copying the header and all items of the source quote.
// Not copied: status/payment/approval history, revision, and images —
// image files live in storage per quote, and sharing paths would let a delete
// on one quote remove the other quote's images.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: src, error: srcErr } = await (supabase as any)
    .from('quotes')
    .select('*, quote_items(*)')
    .eq('id', id)
    .single()
  if (srcErr || !src) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Keep the original validity length, starting from today
  const today = todayIso()
  const validUntil =
    src.quote_date && src.valid_until && src.valid_until > src.quote_date
      ? addDaysIso(today, daysBetweenIso(src.quote_date, src.valid_until))
      : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error: insErr } = await (supabase as any)
    .from('quotes')
    .insert({
      user_id: user.id,
      status: 'draft',
      client_name: src.client_name ?? '',
      client_address: src.client_address ?? '',
      client_contact: src.client_contact ?? '',
      project_description: src.project_description ?? '',
      quote_date: today,
      valid_until: validUntil,
      payment_terms: src.payment_terms ?? '',
      exclusions: src.exclusions ?? '',
      vat_percentage: src.vat_percentage ?? 0,
      price_adjustments: src.price_adjustments ?? [],
      quote_pricing_type: src.quote_pricing_type ?? null,
      pricing_mode: src.pricing_mode ?? 'items',
      manual_total: src.manual_total ?? null,
    })
    .select('id, quote_number')
    .single()
  if (insErr || !created) {
    console.error('[duplicate] quote insert failed', insErr?.message)
    return NextResponse.json({ error: 'Duplicate failed' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = ((src.quote_items ?? []) as any[])
    .sort((a, b) => (a.item_number ?? 0) - (b.item_number ?? 0))
    .map((i) => ({
      quote_id: created.id,
      item_number: i.item_number,
      description: i.description ?? '',
      unit: i.unit ?? 'יח׳',
      quantity: i.quantity ?? 0,
      unit_price: i.unit_price ?? 0,
      notes: i.notes ?? '',
      is_optional: i.is_optional ?? false,
    }))

  if (items.length > 0) {
    // types/database.ts predates is_optional — same cast as QuoteForm
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: itemsErr } = await supabase.from('quote_items').insert(items as any)
    if (itemsErr) {
      console.error('[duplicate] items insert failed', itemsErr.message)
      // Don't leave a half-copied quote behind (quote delete is admin-only under RLS)
      await createAdminClient().from('quotes').delete().eq('id', created.id)
      return NextResponse.json({ error: 'Duplicate failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ id: created.id, quoteNumber: created.quote_number })
}
