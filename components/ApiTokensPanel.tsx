'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { reportClientError } from '@/lib/reportClientError'

interface TokenRow {
  id: string
  name: string
  token_prefix: string
  created_at: string
  last_used_at: string | null
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

// Personal access tokens for AI agents (Instinct, Meta Muse, Claude) — /api/mcp
export function ApiTokensPanel() {
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState<'token' | 'url' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [mcpUrl, setMcpUrl] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('api_tokens')
      .select('id, name, token_prefix, created_at, last_used_at')
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
    setTokens((data ?? []) as TokenRow[])
    setLoaded(true)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-side load
    void load()
    setMcpUrl(`${window.location.origin}/api/mcp`)
  }, [load])

  const create = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'סוכן AI' }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body?.message ?? 'יצירת המפתח נכשלה')
        return
      }
      setNewToken(body.token)
      setName('')
      await load()
    } catch (e) {
      setError('יצירת המפתח נכשלה')
      reportClientError(`יצירת מפתח AI נכשלה: ${e instanceof Error ? e.message : String(e)}`, { context: { kind: 'api-token' } })
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id: string) => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = await (supabase as any).from('api_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    setRevokeId(null)
    if (err) {
      setError('ביטול המפתח נכשל')
      return
    }
    await load()
  }

  const copy = async (what: 'token' | 'url', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // clipboard blocked — the text is still selectable
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3" dir="rtl">
      <h2 className="font-semibold text-gray-700">חיבור לסוכן AI</h2>
      <p className="text-xs text-gray-500 leading-relaxed">
        מאפשר לסוכן (Instinct, Meta Muse, Claude) ליצור עבורך <b>טיוטות</b> הצעה, לחפש לקוחות וסעיפים קודמים.
        הסוכן לא יכול לשלוח, למחוק או לשנות סטטוס. כל פעולה נרשמת על שמך. פרטי ההצעות עוברים דרך ספק הסוכן.
      </p>

      <div className="bg-gray-50 rounded-xl p-3 space-y-1">
        <p className="text-xs text-gray-500">כתובת השרת (MCP, HTTP)</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs break-all" dir="ltr">{mcpUrl}</code>
          <button type="button" onClick={() => copy('url', mcpUrl)} className="text-xs text-orange-600 shrink-0">
            {copied === 'url' ? 'הועתק' : 'העתק'}
          </button>
        </div>
      </div>

      {newToken && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
          <p className="text-sm font-medium text-green-800">המפתח נוצר. העתק אותו עכשיו — הוא לא יוצג שוב.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs break-all bg-white rounded-lg p-2 border border-green-100" dir="ltr">{newToken}</code>
            <button type="button" onClick={() => copy('token', newToken)} className="text-xs text-green-700 font-semibold shrink-0">
              {copied === 'token' ? 'הועתק' : 'העתק'}
            </button>
          </div>
          <p className="text-xs text-green-800">אל תשלח את המפתח בצ׳אט או במייל. הדבק אותו רק בשדה המאובטח של הסוכן.</p>
          <button type="button" onClick={() => setNewToken(null)} className="text-xs text-gray-500">סגור</button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם המפתח (למשל Instinct)"
          maxLength={60}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button type="button" onClick={create} disabled={creating}
          className="px-4 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold disabled:opacity-50 active:bg-orange-700">
          {creating ? 'יוצר...' : 'צור מפתח'}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {loaded && tokens.length > 0 && (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
          {tokens.map((t) => (
            <li key={t.id} className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-gray-800 truncate">{t.name} <span className="text-xs text-gray-400 font-mono" dir="ltr">{t.token_prefix}…</span></p>
                <p className="text-[11px] text-gray-400">
                  נוצר {fmt(t.created_at)} · {t.last_used_at ? `שימוש אחרון ${fmt(t.last_used_at)}` : 'עוד לא בשימוש'}
                </p>
              </div>
              {revokeId === t.id ? (
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => setRevokeId(null)} className="text-xs text-gray-500 px-2 py-1">ביטול</button>
                  <button type="button" onClick={() => revoke(t.id)} className="text-xs text-white bg-red-600 rounded-lg px-2 py-1">בטל מפתח</button>
                </div>
              ) : (
                <button type="button" onClick={() => setRevokeId(t.id)} className="text-xs text-red-500 shrink-0">בטל</button>
              )}
            </li>
          ))}
        </ul>
      )}

      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer text-gray-600">איך מחברים?</summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          <p><b>Instinct:</b> בהגדרות ← אפליקציות מחוברות ← הוספת שרת MCP. הדבק את כתובת השרת, ובשדה ההרשאה את המפתח (Bearer).</p>
          <p><b>Meta Muse:</b> בקש בצ׳אט: &quot;צור מחבר מותאם לשרת MCP בכתובת …, גישה ב-HTTP עם Bearer token&quot;. כשיבקש את המפתח — הדבק אותו רק בחלון המאובטח שלו, לא בצ׳אט. מומלץ להגדיר אישור לכל פעולה.</p>
          <p>אחרי החיבור אפשר לומר לסוכן למשל: &quot;תכין הצעה לרשות שדות התעופה, מסוף רבין: חפירת תעלה 12 מטר והנחת שני שרוולים 75&quot;.</p>
        </div>
      </details>
    </section>
  )
}
