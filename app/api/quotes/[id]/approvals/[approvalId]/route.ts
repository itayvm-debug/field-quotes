import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; approvalId: string }> }
) {
  const { id: quoteId, approvalId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: approval, error: fetchErr } = await (adminClient as any)
    .from('quote_approvals')
    .select('storage_path')
    .eq('id', approvalId)
    .eq('quote_id', quoteId)
    .single()

  if (fetchErr || !approval) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await adminClient.storage.from('quote-approvals').remove([approval.storage_path])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (adminClient as any)
    .from('quote_approvals')
    .delete()
    .eq('id', approvalId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
