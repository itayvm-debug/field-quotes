'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Approval {
  id: string
  file_name: string
  file_type: string | null
  note: string
  created_at: string
  signedUrl: string | null
  uploader: { full_name: string } | null
}

interface Props {
  quoteId: string
  isAdmin: boolean
}

export function QuoteApprovalsPanel({ quoteId, isAdmin }: Props) {
  const router = useRouter()
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [note, setNote] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchApprovals = async () => {
    const res = await fetch(`/api/quotes/${quoteId}/approvals`)
    if (res.ok) {
      const data = await res.json()
      setApprovals(data.approvals ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void fetchApprovals()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')

    const form = new FormData()
    form.append('file', file)
    form.append('note', note.trim())

    const res = await fetch(`/api/quotes/${quoteId}/approvals`, { method: 'POST', body: form })
    if (res.ok) {
      setNote('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchApprovals()
      router.refresh()
    } else {
      const data = await res.json()
      setUploadError(data.error ?? 'שגיאה בהעלאה')
    }
    setUploading(false)
  }

  const handleDelete = async (approvalId: string) => {
    setDeletingId(approvalId)
    const res = await fetch(`/api/quotes/${quoteId}/approvals/${approvalId}`, { method: 'DELETE' })
    if (res.ok) {
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId))
      router.refresh()
    }
    setDeletingId(null)
  }

  const isImage = (fileType: string | null) => fileType?.startsWith('image/') ?? false

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs text-gray-400 mb-3">אסמכתא אישור הצעה</p>

      {loading ? (
        <p className="text-xs text-gray-400">טוען...</p>
      ) : (
        <>
          {approvals.length === 0 && (
            <p className="text-xs text-gray-400 mb-3">לא הועלו מסמכי אישור עדיין.</p>
          )}

          <div className="space-y-3 mb-3">
            {approvals.map((approval) => (
              <div key={approval.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                {isImage(approval.file_type) && approval.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={approval.signedUrl}
                    alt={approval.file_name}
                    className="w-14 h-14 object-cover rounded-xl border border-gray-100 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-gray-400">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <a
                    href={approval.signedUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-orange-600 truncate block"
                  >
                    {approval.file_name}
                  </a>
                  {approval.note && <p className="text-xs text-gray-500 mt-0.5">{approval.note}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {approval.uploader?.full_name ?? ''}
                    {' · '}
                    {new Date(approval.created_at).toLocaleDateString('he-IL', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDelete(approval.id)}
                    disabled={deletingId === approval.id}
                    className="text-red-400 p-1.5 rounded-lg active:bg-red-50 disabled:opacity-50 shrink-0"
                    title="מחק"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Upload form */}
          <div className={approvals.length > 0 ? 'pt-3 border-t border-gray-100' : ''}>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="הערה לקובץ (אופציונלי)"
              disabled={uploading}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 mb-2 disabled:bg-gray-50"
            />
            {uploadError && <p className="text-xs text-red-500 mb-2">{uploadError}</p>}
            <label
              className={`flex items-center justify-center gap-2 w-full py-2.5 border-2 border-dashed rounded-xl text-sm font-semibold transition-colors ${
                uploading
                  ? 'border-gray-200 text-gray-400 pointer-events-none'
                  : 'border-orange-300 text-orange-600 active:bg-orange-50 cursor-pointer'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {uploading ? 'מעלה...' : 'העלה מסמך אישור'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>
          </div>
        </>
      )}
    </div>
  )
}
