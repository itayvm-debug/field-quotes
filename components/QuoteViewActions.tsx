'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STATUS_LABELS, STATUS_COLORS, type QuoteStatus } from '@/types'
import { shareQuotePdf } from '@/lib/share/shareQuotePdf'

const ACTIVE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected']

interface Props {
  quoteId: string
  quoteNumber: string | null
  clientName: string
  totalFormatted: string
  currentStatus: string
  userRole: string
  companyName: string
}

export function QuoteViewActions({
  quoteId,
  quoteNumber,
  clientName,
  totalFormatted,
  currentStatus,
  userRole,
  companyName,
}: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [archiveWorking, setArchiveWorking] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteWorking, setDeleteWorking] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'loading' | 'unsupported'>('idle')

  const isArchived = status === 'archived'
  const isAdmin = userRole === 'admin'
  const canEdit = userRole !== 'viewer'

  const changeStatus = async (next: QuoteStatus) => {
    if (next === status || statusUpdating) return
    setStatusUpdating(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('quotes').update({ status: next as any }).eq('id', quoteId)
    setStatus(next)
    setStatusUpdating(false)
  }

  const handleArchive = async () => {
    setArchiveWorking(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('quotes').update({ status: 'archived' as any }).eq('id', quoteId)
    router.push('/dashboard')
  }

  const handleRestore = async () => {
    setArchiveWorking(true)
    const supabase = createClient()
    await supabase.from('quotes').update({ status: 'draft' }).eq('id', quoteId)
    setStatus('draft')
    setArchiveWorking(false)
    setArchiveConfirm(false)
    router.refresh()
  }

  const handlePermanentDelete = async () => {
    setDeleteWorking(true)
    const supabase = createClient()
    const { data: itemRows } = await supabase
      .from('quote_items').select('id').eq('quote_id', quoteId)
    const itemIds = (itemRows ?? []).map((r) => r.id)
    if (itemIds.length > 0) {
      const { data: imgRows } = await supabase
        .from('item_images').select('storage_path').in('item_id', itemIds)
      const paths = (imgRows ?? []).map((r) => r.storage_path)
      if (paths.length > 0) await supabase.storage.from('quote-images').remove(paths)
    }
    await supabase.from('quotes').delete().eq('id', quoteId)
    router.push('/dashboard?status=archived')
  }

  const handleSharePdf = async () => {
    setShareState('loading')
    const result = await shareQuotePdf(quoteId, quoteNumber, companyName, clientName)
    if (result.status === 'shared' || result.status === 'cancelled') {
      setShareState('idle')
    } else {
      setShareState('unsupported')
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Status change — non-viewer, non-archived */}
      {canEdit && !isArchived && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-2.5">שנה סטטוס</p>
          <div className="flex gap-1.5 flex-wrap">
            {ACTIVE_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeStatus(s)}
                disabled={statusUpdating}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-60 ${
                  s === status
                    ? STATUS_COLORS[s]
                    : 'bg-gray-100 text-gray-500 active:bg-gray-200'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Share PDF + Archive/Restore/Delete */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        {/* Share PDF */}
        {shareState === 'unsupported' ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              שיתוף ישיר אינו נתמך במכשיר זה.
              ניתן להוריד את ה-PDF ולשלוח ידנית.
            </p>
            <button
              type="button"
              onClick={() => setShareState('idle')}
              className="w-full py-2 rounded-xl text-xs text-gray-400 active:text-gray-600"
            >
              הבנתי
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSharePdf}
            disabled={shareState === 'loading'}
            className="w-full py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-sm font-semibold active:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {shareState === 'loading' ? 'מכין קובץ PDF...' : 'שתף PDF'}
          </button>
        )}

        {/* Non-archived: archive button */}
        {!isArchived && canEdit && !archiveConfirm && (
          <button
            type="button"
            onClick={() => setArchiveConfirm(true)}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium active:bg-gray-50"
          >
            העבר לארכיון
          </button>
        )}

        {!isArchived && archiveConfirm && (
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <p className="text-sm text-gray-700 font-medium text-center">להעביר לארכיון?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setArchiveConfirm(false)}
                disabled={archiveWorking}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 bg-white disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={handleArchive}
                disabled={archiveWorking}
                className="flex-1 py-2.5 bg-gray-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {archiveWorking ? 'מעביר...' : 'כן, ארכיון'}
              </button>
            </div>
          </div>
        )}

        {/* Archived: restore + admin delete */}
        {isArchived && (
          <div className="space-y-2">
            <button
              onClick={handleRestore}
              disabled={archiveWorking}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium active:bg-gray-50 disabled:opacity-50"
            >
              {archiveWorking ? 'משחזר...' : 'שחזר מארכיון'}
            </button>

            {isAdmin && !deleteConfirm && (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="w-full py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-medium active:bg-red-100"
              >
                מחק לצמיתות
              </button>
            )}

            {isAdmin && deleteConfirm && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                <p className="text-sm text-red-700 font-medium text-center">מחיקה בלתי הפיכה — להמשיך?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    disabled={deleteWorking}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 bg-white disabled:opacity-50"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={handlePermanentDelete}
                    disabled={deleteWorking}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    {deleteWorking ? 'מוחק...' : 'מחק לצמיתות'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
