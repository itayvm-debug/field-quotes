import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateToken, hashToken, tokenDisplayPrefix } from '@/lib/apiTokens'
import { logServerError } from '@/lib/errorLog'

export const dynamic = 'force-dynamic'

const MAX_ACTIVE_TOKENS = 5

// POST /api/tokens { name } — creates a personal access token for an AI agent.
// The plain token is returned ONCE; only its hash is stored.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let name = ''
  try {
    const body = await req.json()
    name = typeof body?.name === 'string' ? body.name.trim().slice(0, 60) : ''
  } catch {
    // empty body is fine
  }
  if (!name) name = 'סוכן AI'

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any
  const { count } = await db
    .from('api_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('revoked_at', null)
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS) {
    return NextResponse.json({ error: 'limit', message: `אפשר עד ${MAX_ACTIVE_TOKENS} מפתחות פעילים. בטל מפתח ישן קודם.` }, { status: 400 })
  }

  const token = generateToken()
  const { error } = await db.from('api_tokens').insert({
    user_id: user.id,
    name,
    token_hash: hashToken(token),
    token_prefix: tokenDisplayPrefix(token),
  })
  if (error) {
    await logServerError(new Error(`token create failed: ${error.message}`), { route: '/api/tokens', userId: user.id })
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
  return NextResponse.json({ token })
}
