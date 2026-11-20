'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { reportClientError } from '@/lib/reportClientError'

interface Props {
  client: { id: string; name: string; contact: string; email: string; notes: string; aliases: string[] }
  canEdit: boolean
  isAdmin: boolean
  otherClients: Array<{ id: string; name: string }>
}

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent'

export function ClientEditor({ client, canEdit, isAdmin, otherClients }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({ name: client.name, contact: client.contact, email: client.email, notes: client.notes })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [mergeTarget, setMergeTarget] = useState('')
  const [mergeConfirm, setMergeConfirm] = useState(false)
  const [merging, setMerging] = useState(false)

  const dirty =
    form.name !== client.name || form.contact !== client.contact ||
    form.email !== client.email || form.notes !== client.notes

  const save = async () => {
    if (!form.name.trim()) {
      setMessage({ ok: false, text: 'שם הלקוח לא יכול להיות ריק' })
      return
    }
    setSaving(true)
    setMessage(null)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('clients')
      .update({ name: form.name.trim(), contact: form.contact, email: form.email.trim(), notes: form.notes })
      .eq('id', client.id)
    setSaving(false)
    if (error) {
      const duplicate = error.code === '23505'
      setMessage({ ok: false, text: duplicate ? 'כבר קיים לקוח בשם הזה — אפשר למזג במקום לשנות שם' : 'שגיאה בשמירה' })
      if (!duplicate) reportClientError(`עדכון לקוח נכשל: ${error.message}`, { context: { kind: 'client-update', clientId: client.id } })
      return
    }
    setMessage({ ok: true, text: 'נשמר' })
    router.refresh()
  }

  const merge = async () => {
    if (!mergeTarget) return
    setMerging(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('merge_clients', { p_source: client.id, p_target: mergeTarget })
    if (error) {
      setMerging(false)
      setMergeConfirm(false)
      setMessage({ ok: false, text: 'המיזוג נכשל' })
      reportClientError(`מיזוג לקוחות נכשל: ${error.message}`, { context: { kind: 'client-merge', source: client.id, target: mergeTarget } })
      return
    }
    router.push(`/clients/${mergeTarget}`)
    router.refresh()
  }

  const targetName = otherClients.find((c) => c.id === mergeTarget)?.name ?? ''

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <h2 className="font-semibold text-gray-700">פרטי לקוח</h2>

      <Field label="שם לקוח">
        <input className={inputCls} value={form.name} disabled={!canEdit}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="איש קשר ברירת מחדל (ימולא בהצעה חדשה)">
        <input className={inputCls} value={form.contact} disabled={!canEdit} placeholder="שם וטלפון"
          onChange={(e) => setForm({ ...form, contact: e.target.value })} />
      </Field>
      <Field label="אימייל">
        <input className={inputCls} value={form.email} disabled={!canEdit} dir="ltr" type="email"
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <Field label="הערות פנימיות">
        <textarea className={`${inputCls} resize-none`} rows={2} value={form.notes} disabled={!canEdit}
          onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>

      {client.aliases.length > 0 && (
        <p className="text-xs text-gray-400">שמות נוספים שמשויכים ללקוח: {client.aliases.join(' · ')}</p>
      )}
      <p className="text-xs text-gray-400">שינוי שם לא משנה הצעות שכבר נשלחו. השם הקודם נשמר כשם נוסף.</p>

      {message && <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-red-500'}`}>{message.text}</p>}

      {canEdit && (
        <button type="button" onClick={save} disabled={!dirty || saving}
          className="w-full py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold disabled:opacity-40 active:bg-orange-700">
          {saving ? 'שומר...' : 'שמור פרטי לקוח'}
        </button>
      )}

      {isAdmin && otherClients.length > 0 && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-sm font-medium text-gray-700">מיזוג לקוח כפול</p>
          <p className="text-xs text-gray-400">
            כל ההצעות של &quot;{client.name}&quot; יעברו ללקוח שתבחר, והשם הזה יישמר אצלו כשם נוסף. ההצעות עצמן לא משתנות.
          </p>
          <select className={inputCls} value={mergeTarget}
            onChange={(e) => { setMergeTarget(e.target.value); setMergeConfirm(false) }}>
            <option value="">בחר לקוח יעד...</option>
            {otherClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {mergeTarget && !mergeConfirm && (
            <button type="button" onClick={() => setMergeConfirm(true)}
              className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium active:bg-gray-50">
              מזג לתוך &quot;{targetName}&quot;
            </button>
          )}
          {mergeConfirm && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <p className="text-sm text-amber-800 text-center">
                למזג את &quot;{client.name}&quot; לתוך &quot;{targetName}&quot;? הלקוח הנוכחי יימחק מהרשימה.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMergeConfirm(false)} disabled={merging}
                  className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 bg-white">ביטול</button>
                <button type="button" onClick={merge} disabled={merging}
                  className="flex-1 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {merging ? 'ממזג...' : 'כן, מזג'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  )
}
