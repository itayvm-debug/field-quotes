import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { usernameToInternalEmail } from '@/lib/auth/username'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['user', 'admin', 'manager', 'viewer']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { username, password, full_name, job_title, role } = body

  if (!username || !password || !full_name) {
    return NextResponse.json({ error: 'שם משתמש, שם מלא וסיסמה הם שדות חובה' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 6) {
    return NextResponse.json({ error: 'הסיסמה קצרה מדי (לפחות 6 תווים)' }, { status: 400 })
  }
  if (role && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const email = usernameToInternalEmail(String(username))
  const adminClient = createAdminClient()

  const { data: newAuthUser, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileErr } = await (adminClient as any).from('profiles').upsert({
    id: newAuthUser.user.id,
    full_name: String(full_name).trim(),
    job_title: String(job_title ?? '').trim(),
    role: role ?? 'user',
    is_active: true,
  })

  if (profileErr) {
    await adminClient.auth.admin.deleteUser(newAuthUser.user.id)
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, user_id: newAuthUser.user.id })
}
