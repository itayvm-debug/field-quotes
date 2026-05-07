import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Verify caller is authenticated and is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { target_user_id, new_password } = body as Record<string, unknown>

  if (!target_user_id || typeof target_user_id !== 'string') {
    return NextResponse.json({ error: 'target_user_id is required' }, { status: 400 })
  }
  if (!new_password || typeof new_password !== 'string') {
    return NextResponse.json({ error: 'new_password is required' }, { status: 400 })
  }
  if (new_password.length < 6) {
    return NextResponse.json({ error: 'הסיסמה קצרה מדי (לפחות 6 תווים)' }, { status: 400 })
  }

  // Verify service role key is available before attempting admin operation
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json(
      { error: 'מפתח ניהול חסר בשרת. לא ניתן לעדכן סיסמה.' },
      { status: 500 }
    )
  }

  // Import dynamically to keep service role key off the client bundle
  let adminClient: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    adminClient = createAdminClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `שגיאת אתחול שרת: ${msg}` }, { status: 500 })
  }

  // Verify target user exists in auth.users
  const { data: targetUser, error: lookupErr } = await adminClient.auth.admin.getUserById(target_user_id)
  if (lookupErr || !targetUser?.user) {
    return NextResponse.json({ error: 'המשתמש לא נמצא במערכת' }, { status: 404 })
  }

  // Perform the password update via Admin API
  const { error: authErr } = await adminClient.auth.admin.updateUserById(target_user_id, {
    password: new_password,
  })

  // Do NOT echo the password back under any circumstances
  if (authErr) {
    return NextResponse.json(
      { error: `עדכון סיסמה נכשל: ${authErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
