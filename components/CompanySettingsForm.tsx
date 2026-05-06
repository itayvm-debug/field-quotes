'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CompanySettings } from '@/types'

interface Props {
  initial: Omit<CompanySettings, 'id'>
  logoUrl: string | null
}

export function CompanySettingsForm({ initial, logoUrl: initialLogoUrl }: Props) {
  const [form, setForm] = useState(initial)
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const setField = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleLogoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `logo/company_logo.${ext}`

    setUploadingLogo(true)
    setError(null)

    const { error: uploadErr } = await supabase.storage
      .from('company-assets')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      setError(`שגיאת העלאת לוגו: ${uploadErr.message}`)
      setUploadingLogo(false)
      return
    }

    const { data: urlData } = await supabase.storage
      .from('company-assets')
      .createSignedUrl(path, 3600)

    setForm((f) => ({ ...f, logo_storage_path: path }))
    setLogoUrl(urlData?.signedUrl ?? null)
    setUploadingLogo(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    const { error: saveErr } = await supabase
      .from('company_settings')
      .update({
        company_name: form.company_name,
        company_id_number: form.company_id_number,
        address: form.address,
        phone: form.phone,
        email: form.email,
        logo_storage_path: form.logo_storage_path,
        footer_text: form.footer_text,
        default_payment_terms: form.default_payment_terms,
        default_exclusions: form.default_exclusions,
      })
      .eq('singleton_key', 1)

    setSaving(false)
    if (saveErr) {
      setError(saveErr.message)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">
          ✓ הגדרות נשמרו בהצלחה
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Logo */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <h2 className="font-semibold text-gray-700">לוגו חברה</h2>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="לוגו חברה"
              className="h-16 w-auto rounded-xl border border-gray-100 object-contain bg-gray-50 p-1"
            />
          ) : (
            <div className="h-16 w-24 rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-xs">
              אין לוגו
            </div>
          )}
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
            className="text-sm text-orange-600 font-medium active:opacity-70 disabled:opacity-40"
          >
            {uploadingLogo ? 'מעלה...' : logoUrl ? 'החלף לוגו' : 'העלה לוגו'}
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleLogoUpload(e.target.files)}
          />
        </div>
      </section>

      {/* Company details */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <h2 className="font-semibold text-gray-700">פרטי חברה</h2>

        <Field label="שם החברה">
          <input
            type="text"
            value={form.company_name}
            onChange={(e) => setField('company_name', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="ח.פ / ע.מ">
          <input
            type="text"
            value={form.company_id_number}
            onChange={(e) => setField('company_id_number', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="כתובת">
          <input
            type="text"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="טלפון">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              className={inputCls}
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
          </Field>
          <Field label="אימייל">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              className={inputCls}
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
          </Field>
        </div>
      </section>

      {/* Defaults */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <h2 className="font-semibold text-gray-700">ברירות מחדל להצעה</h2>
        <Field label="תנאי תשלום ברירת מחדל">
          <input
            type="text"
            value={form.default_payment_terms}
            onChange={(e) => setField('default_payment_terms', e.target.value)}
            className={inputCls}
            placeholder="לדוגמה: שוטף + 30"
          />
        </Field>
        <Field label="החרגות ברירת מחדל">
          <textarea
            value={form.default_exclusions}
            onChange={(e) => setField('default_exclusions', e.target.value)}
            rows={2}
            className={`${inputCls} resize-none`}
            placeholder="מה לא כלול כברירת מחדל..."
          />
        </Field>
        <Field label="טקסט פוטר (בתחתית PDF)">
          <textarea
            value={form.footer_text}
            onChange={(e) => setField('footer_text', e.target.value)}
            rows={2}
            className={`${inputCls} resize-none`}
            placeholder="יופיע בתחתית הצעת המחיר..."
          />
        </Field>
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-orange-600 text-white py-4 rounded-2xl text-lg font-bold disabled:opacity-50 active:bg-orange-700 transition-colors"
      >
        {saving ? 'שומר...' : 'שמור הגדרות'}
      </button>
    </div>
  )
}

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
