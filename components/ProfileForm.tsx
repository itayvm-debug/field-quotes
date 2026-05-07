'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SignaturePad } from '@/components/SignaturePad'
import { SignatureImageUpload } from '@/components/SignatureImageUpload'

interface Props {
  userId: string
  initialFullName: string
  initialJobTitle: string
  initialSignatureUrl: string | null
  initialSignaturePath: string | null
}

export function ProfileForm({
  userId,
  initialFullName,
  initialJobTitle,
  initialSignatureUrl,
  initialSignaturePath,
}: Props) {
  const router = useRouter()

  const [fullName, setFullName] = useState(initialFullName)
  const [jobTitle, setJobTitle] = useState(initialJobTitle)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(initialSignatureUrl)
  const [signaturePath, setSignaturePath] = useState<string | null>(initialSignaturePath)
  const [showPad, setShowPad] = useState(!initialSignaturePath)
  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbErr } = await supabase.from('profiles').update({ full_name: fullName, job_title: jobTitle } as any).eq('id', userId)
    if (dbErr) {
      setError('שגיאה בשמירה — נסה שוב')
    } else {
      setSuccess('הפרטים עודכנו בהצלחה')
      setTimeout(() => setSuccess(''), 3000)
      router.refresh()
    }
    setSaving(false)
  }

  const handleSignatureSave = async (dataUrl: string) => {
    setUploading(true)
    setError('')
    const supabase = createClient()
    const path = `${userId}/signature.png`

    const blob = await fetch(dataUrl).then((r) => r.blob())
    const file = new File([blob], 'signature.png', { type: 'image/png' })

    const { error: upErr } = await supabase.storage
      .from('user-signatures')
      .upload(path, file, { upsert: true })

    if (upErr) {
      setError('שגיאה בשמירת החתימה')
      setUploading(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('profiles').update({ signature_storage_path: path } as any).eq('id', userId)
    const { data: urlData } = await supabase.storage.from('user-signatures').createSignedUrl(path, 3600)
    setSignaturePath(path)
    setSignatureUrl(urlData?.signedUrl ?? null)
    setShowPad(false)
    setUploading(false)
    router.refresh()
  }

  const handleImageSave = async (file: File) => {
    setUploading(true)
    setError('')
    const supabase = createClient()
    const path = `${userId}/signature.png`

    const { error: upErr } = await supabase.storage
      .from('user-signatures')
      .upload(path, file, { contentType: file.type, upsert: true })

    if (upErr) {
      setError('שגיאה בשמירת החתימה')
      setUploading(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('profiles').update({ signature_storage_path: path } as any).eq('id', userId)
    const { data: urlData } = await supabase.storage.from('user-signatures').createSignedUrl(path, 3600)
    setSignaturePath(path)
    setSignatureUrl(urlData?.signedUrl ?? null)
    setShowPad(false)
    setUploading(false)
    router.refresh()
  }

  const handleDelete = async () => {
    if (!signaturePath) return
    setUploading(true)
    const supabase = createClient()
    await supabase.storage.from('user-signatures').remove([signaturePath])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('profiles').update({ signature_storage_path: null } as any).eq('id', userId)
    setSignaturePath(null)
    setSignatureUrl(null)
    setShowPad(true)
    setUploading(false)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* Details */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            disabled={saving}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">תפקיד / מחלקה</label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="לדוגמה: נגריית ולדמן"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            disabled={saving}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-orange-600 text-white rounded-xl font-semibold text-sm active:bg-orange-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'שומר...' : 'עדכן פרטים'}
      </button>

      {/* Signature */}
      <div className="border-t border-gray-100 pt-5 space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-0.5">חתימה אישית</p>
          <p className="text-xs text-gray-400">תופיע בסוף כל הצעת מחיר שתפיק</p>
        </div>

        {showPad ? (
          <>
            {/* Tab switcher */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setSignatureMode('draw')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  signatureMode === 'draw'
                    ? 'bg-orange-600 text-white'
                    : 'bg-white text-gray-500 active:bg-gray-50'
                }`}
              >
                שרטוט
              </button>
              <button
                type="button"
                onClick={() => setSignatureMode('upload')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  signatureMode === 'upload'
                    ? 'bg-orange-600 text-white'
                    : 'bg-white text-gray-500 active:bg-gray-50'
                }`}
              >
                העלאת תמונה
              </button>
            </div>

            {signatureMode === 'draw' ? (
              <SignaturePad onSave={handleSignatureSave} disabled={uploading} />
            ) : (
              <SignatureImageUpload onSave={handleImageSave} disabled={uploading} />
            )}

            {signaturePath && (
              <button
                type="button"
                onClick={() => setShowPad(false)}
                disabled={uploading}
                className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 active:bg-gray-50 disabled:opacity-40"
              >
                ביטול
              </button>
            )}
          </>
        ) : (
          <>
            {signatureUrl && (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signatureUrl} alt="חתימה" className="h-16 object-contain" />
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPad(true)}
                disabled={uploading}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium active:bg-gray-50 disabled:opacity-50"
              >
                חתום מחדש
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={uploading}
                className="py-2.5 px-4 border border-red-200 rounded-xl text-sm text-red-500 font-medium active:bg-red-50 disabled:opacity-50"
              >
                {uploading ? '...' : 'מחק חתימה'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Signature preview */}
      <div className="border-t border-gray-100 pt-5">
        <p className="text-xs text-gray-400 mb-3">תצוגה מקדימה — כפי שיופיע בסוף ההצעה</p>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          {signatureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signatureUrl} alt="חתימה" className="h-12 object-contain mb-2" />
          )}
          <p className="text-sm text-gray-600">בברכה,</p>
          <p className="text-sm font-semibold text-gray-900">
            {fullName || '(שם מלא)'}
            {jobTitle ? ` - ${jobTitle}` : ''}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            שם החברה יופיע כאן לפי הגדרות המערכת
          </p>
        </div>
      </div>
    </div>
  )
}
