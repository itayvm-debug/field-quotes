import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClearErrorsButton } from '@/components/ClearErrorsButton'
import { isoHoursAgo } from '@/lib/dates'

export const dynamic = 'force-dynamic'

interface AppErrorRow {
  id: string
  created_at: string
  source: string
  route: string | null
  message: string
  details: string | null
  user_id: string | null
  context: Record<string, unknown>
}

const fmtIsraelTime = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))

export default async function AdminErrorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // RLS: only admins can read app_errors
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rowsRaw } = await (supabase as any)
    .from('app_errors')
    .select('id, created_at, source, route, message, details, user_id, context')
    .order('created_at', { ascending: false })
    .limit(200)
  const rows: AppErrorRow[] = rowsRaw ?? []

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
  const names = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
    for (const p of profiles ?? []) names.set(p.id, p.full_name ?? '')
  }

  const dayAgo = isoHoursAgo(24)
  const last24h = rows.filter((r) => new Date(r.created_at).toISOString() > dayAgo).length

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-900">שגיאות מערכת</h1>
          {last24h > 0 && (
            <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {last24h} ב-24 שעות
            </span>
          )}
        </div>
        {rows.length > 0 && <ClearErrorsButton />}
      </div>
      <p className="px-4 max-w-2xl mx-auto text-xs text-gray-400 mb-2">
        שגיאות שרת ודפדפן נרשמות כאן אוטומטית ונשמרות 90 יום. מוצגות 200 האחרונות.
      </p>

      <main className="px-4 pb-4 max-w-2xl mx-auto space-y-2">
        {rows.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">אין שגיאות 🎉</p>
          </div>
        ) : (
          rows.map((r) => {
            const ctx = r.context && Object.keys(r.context).length > 0 ? JSON.stringify(r.context, null, 2) : null
            return (
              <details key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <summary className="p-3 cursor-pointer list-none space-y-1">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        r.source === 'client' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {r.source === 'client' ? 'דפדפן' : 'שרת'}
                    </span>
                    <span>{fmtIsraelTime(r.created_at)}</span>
                    {r.user_id && <span>· {names.get(r.user_id) || 'משתמש'}</span>}
                  </div>
                  <p className="text-sm text-gray-900 font-medium break-words">{r.message}</p>
                  {r.route && <p className="text-xs text-gray-400 font-mono break-all" dir="ltr">{r.route}</p>}
                </summary>
                {(r.details || ctx) && (
                  <div className="px-3 pb-3 space-y-2">
                    {ctx && (
                      <pre className="text-[11px] bg-gray-50 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all" dir="ltr">{ctx}</pre>
                    )}
                    {r.details && (
                      <pre className="text-[11px] bg-gray-50 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all" dir="ltr">{r.details}</pre>
                    )}
                  </div>
                )}
              </details>
            )
          })
        )}
      </main>
    </div>
  )
}
