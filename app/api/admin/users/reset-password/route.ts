import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { target_user_id, new_password } = body

  if (!target_user_id || !new_password) {
    return NextResponse.json({ error: 'target_user_id and new_password required' }, { status: 400 })
  }
  if (typeof new_password !== 'string' || new_password.length < 6) {
    return NextResponse.json({ error: 'הסיסמה קצרה מדי (לפחות 6 תווים)' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { error: authErr } = await adminClient.auth.admin.updateUserById(target_user_id, {
    password: new_password,
  })

  // Do not echo back the password under any circumstances
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
