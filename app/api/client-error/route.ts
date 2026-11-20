import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logServerError } from '@/lib/errorLog'

export const dynamic = 'force-dynamic'

// POST /api/client-error — browser-side errors (save failures, error boundary).
// Signed-in users only; payload is size-capped and rate-limited per instance.
const recent = new Map<string, number[]>()
const MAX_PER_MINUTE = 20

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = Date.now()
  const times = (recent.get(user.id) ?? []).filter((t) => now - t < 60_000)
  if (times.length >= MAX_PER_MINUTE) return NextResponse.json({ ok: false }, { status: 429 })
  recent.set(user.id, [...times, now])

  let body: { message?: unknown; route?: unknown; details?: unknown; context?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const message = typeof body.message === 'string' && body.message.trim() ? body.message : null
  if (!message) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const err = new Error(message)
  err.stack = typeof body.details === 'string' ? body.details : ''
  await logServerError(err, {
    source: 'client',
    route: typeof body.route === 'string' ? body.route : null,
    userId: user.id,
    context:
      body.context && typeof body.context === 'object' && !Array.isArray(body.context)
        ? (body.context as Record<string, unknown>)
        : {},
  })
  return NextResponse.json({ ok: true })
}
