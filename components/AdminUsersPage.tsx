'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/calculations'
import type { AdminUserRow } from '@/app/(protected)/admin/users/page'

const INTERNAL_DOMAIN = 'field-quotes.internal'

function deriveUsername(email: string): string {
  if (email.endsWith('@' + INTERNAL_DOMAIN)) {
    return email.replace('@' + INTERNAL_DOMAIN, '').toUpperCase()
  }
  return ''
}

function usernameToEmail(username: string): string {
  return username.trim().toLowerCase().replace(/\s+/g, '-') + '@' + INTERNAL_DOMAIN
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'מנהל מערכת',
  manager: 'מנהל',
  user: 'משתמש',
  viewer: 'צפייה בלבד',
}
const ROLE_OPTIONS = ['user', 'admin', 'manager', 'viewer'] as const

function fmtDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUserRow
  onClose: () => void
  onSaved: () => void
}) {
  const [fullName, setFullName] = useState(user.full_name)
  const [jobTitle, setJobTitle] = useState(user.job_title)
  const [role, setRole] = useState(user.role)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!fullName.trim()) { setError('שם מלא הוא שדה חובה'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: user.id, full_name: fullName, job_title: jobTitle, role }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'שגיאה בשמירה'); setSaving(false); return }
    onSaved()
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <h2 className="text-base font-semibold text-gray-900 mb-4">עריכת משתמש</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">שם מלא <span className="text-red-400">*</span></label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={saving}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">תפקיד / מחלקה</label>
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} disabled={saving}
            placeholder="לדוגמה: מנהל פרויקטים"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">תפקיד מערכת</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={saving}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} disabled={saving}
          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 disabled:opacity-50">ביטול</button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </ModalBackdrop>
  )
}

// ── Reset password modal ──────────────────────────────────────────────────────
function ResetPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUserRow
  onClose: () => void
  onSaved: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const mismatch = confirm.length > 0 && password !== confirm

  const handleSave = async () => {
    if (password.length < 6) { setError('הסיסמה קצרה מדי (לפחות 6 תווים)'); return }
    if (password !== confirm) { setError('הסיסמאות אינן זהות'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/users/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: user.id, new_password: password }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'שגיאה באיפוס'); setSaving(false); return }
    onSaved()
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <h2 className="text-base font-semibold text-gray-900 mb-1">איפוס סיסמה</h2>
      <p className="text-xs text-gray-400 mb-4">{user.full_name} · {user.email}</p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">סיסמה חדשה</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={saving}
            autoComplete="new-password"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">אימות סיסמה</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={saving}
            autoComplete="new-password"
            className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${mismatch ? 'border-red-300' : 'border-gray-200'}`} />
          {mismatch && <p className="text-xs text-red-500 mt-1">הסיסמאות אינן זהות</p>}
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} disabled={saving}
          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 disabled:opacity-50">ביטול</button>
        <button onClick={handleSave} disabled={saving || password.length < 6 || mismatch}
          className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          {saving ? 'מאפס...' : 'אפס סיסמה'}
        </button>
      </div>
    </ModalBackdrop>
  )
}

// ── Create user modal ─────────────────────────────────────────────────────────
function CreateUserModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fullName, setFullName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [role, setRole] = useState('user')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const mismatch = confirm.length > 0 && password !== confirm
  const previewEmail = username.trim() ? usernameToEmail(username) : ''

  const handleCreate = async () => {
    if (!username.trim() || !fullName.trim() || !password) { setError('שם משתמש, שם מלא וסיסמה הם שדות חובה'); return }
    if (password.length < 6) { setError('הסיסמה קצרה מדי (לפחות 6 תווים)'); return }
    if (password !== confirm) { setError('הסיסמאות אינן זהות'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password, full_name: fullName, job_title: jobTitle, role }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'שגיאה ביצירה'); setSaving(false); return }
    onSaved()
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <h2 className="text-base font-semibold text-gray-900 mb-4">משתמש חדש</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">שם מלא <span className="text-red-400">*</span></label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={saving}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">שם משתמש <span className="text-red-400">*</span></label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} disabled={saving}
            placeholder="SHAI-ZENATI"
            autoComplete="off"
            dir="ltr"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono" />
          {previewEmail && (
            <p className="text-[11px] text-gray-400 mt-1 dir-ltr" dir="ltr">{previewEmail}</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">תפקיד / מחלקה</label>
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} disabled={saving}
            placeholder="לדוגמה: מנהל פרויקטים"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">תפקיד מערכת</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={saving}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">סיסמה ראשונית <span className="text-red-400">*</span></label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={saving}
            autoComplete="new-password"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">אימות סיסמה <span className="text-red-400">*</span></label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={saving}
            autoComplete="new-password"
            className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${mismatch ? 'border-red-300' : 'border-gray-200'}`} />
          {mismatch && <p className="text-xs text-red-500 mt-1">הסיסמאות אינן זהות</p>}
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} disabled={saving}
          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 disabled:opacity-50">ביטול</button>
        <button onClick={handleCreate}
          disabled={saving || !username.trim() || !fullName.trim() || password.length < 6 || mismatch}
          className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          {saving ? 'יוצר...' : 'צור משתמש'}
        </button>
      </div>
    </ModalBackdrop>
  )
}

// ── Modal backdrop ────────────────────────────────────────────────────────────
function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function AdminUsersPage({ users }: { users: AdminUserRow[] }) {
  const router = useRouter()
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null)
  const [resetUser, setResetUser] = useState<AdminUserRow | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const handleToggleActive = async (user: AdminUserRow) => {
    setToggling(user.id)
    const res = await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: user.id, is_active: !user.is_active }),
    })
    setToggling(null)
    if (res.ok) router.refresh()
  }

  const onSaved = () => {
    setEditUser(null)
    setResetUser(null)
    setShowCreate(false)
    router.refresh()
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">ניהול משתמשים</h1>
          <p className="text-xs text-gray-400 mt-0.5">{users.length} משתמשים</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-sm font-semibold px-4 py-2 bg-orange-600 text-white rounded-xl active:bg-orange-700"
        >
          + משתמש חדש
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-medium">
                <th className="text-right px-4 py-3">שם מלא</th>
                <th className="text-right px-3 py-3">שם משתמש</th>
                <th className="text-right px-3 py-3">אימייל / מזהה</th>
                <th className="text-right px-3 py-3">תפקיד</th>
                <th className="text-center px-3 py-3">הרשאה</th>
                <th className="text-center px-3 py-3">סטטוס</th>
                <th className="text-center px-2 py-3">הצעות</th>
                <th className="text-center px-2 py-3">אושרו</th>
                <th className="text-right px-3 py-3">שולם</th>
                <th className="text-right px-3 py-3">הצטרף</th>
                <th className="text-center px-3 py-3">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''} ${!u.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                    {u.full_name || <span className="text-gray-300">(ללא שם)</span>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    <span className="font-mono text-gray-700 text-xs">{deriveUsername(u.email) || '—'}</span>
                  </td>
                  <td className="px-3 py-3 text-gray-400 whitespace-nowrap text-xs" dir="ltr">
                    {u.email.endsWith('@' + INTERNAL_DOMAIN) ? '—' : (u.email || '—')}
                  </td>
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{u.job_title || '—'}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.role === 'admin' ? 'bg-orange-100 text-orange-700' :
                      u.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                      u.role === 'viewer' ? 'bg-gray-100 text-gray-500' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {u.is_active ? 'פעיל' : 'לא פעיל'}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center text-gray-700">{u.quoteCount || '—'}</td>
                  <td className="px-2 py-3 text-center text-green-700">{u.acceptedCount || '—'}</td>
                  <td className="px-3 py-3 text-right text-gray-700">
                    {u.paidTotal > 0 ? formatCurrency(u.paidTotal) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-400 whitespace-nowrap">{fmtDate(u.created_at)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditUser(u)}
                        className="text-xs text-orange-600 font-medium px-2 py-1 rounded-lg active:bg-orange-50 whitespace-nowrap"
                      >
                        עדכן
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetUser(u)}
                        className="text-xs text-gray-500 font-medium px-2 py-1 rounded-lg active:bg-gray-100 whitespace-nowrap"
                      >
                        סיסמה
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        disabled={toggling === u.id}
                        className={`text-xs font-medium px-2 py-1 rounded-lg disabled:opacity-50 whitespace-nowrap ${
                          u.is_active
                            ? 'text-red-500 active:bg-red-50'
                            : 'text-green-600 active:bg-green-50'
                        }`}
                      >
                        {toggling === u.id ? '...' : u.is_active ? 'השבת' : 'הפעל'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <p className="text-center text-gray-400 py-12 text-sm">אין משתמשים</p>
        )}
      </div>

      {/* Modals */}
      {editUser && <EditModal user={editUser} onClose={() => setEditUser(null)} onSaved={onSaved} />}
      {resetUser && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} onSaved={onSaved} />}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onSaved={onSaved} />}
    </>
  )
}
