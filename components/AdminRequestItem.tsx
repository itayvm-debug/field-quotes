'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  id: string
  senderName: string
  subject: string
  message: string
  status: string
  createdAt: string
}

export function AdminRequestItem({ id, senderName, subject, message, status, createdAt }: Props) {
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isResolved = status === 'resolved'

  const toggleStatus = async () => {
    setWorking(true)
    const supabase = createClient()
    const next = isResolved ? 'open' : 'resolved'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('support_requests')
      .update({
        status: next,
        resolved_at: next === 'resolved' ? new Date().toISOString() : null,
      })
      .eq('id', id)
    setWorking(false)
    router.refresh()
  }

  const handleDelete = async () => {
    setWorking(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('support_requests').delete().eq('id', id)
    router.refresh()
  }

  const dateLabel = new Date(createdAt).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isResolved ? 'border-gray-100 opacity-60' : 'border-orange-100'}`}>
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">{subject}</p>
            <p className="text-xs text-gray-400 mt-0.5">{senderName} · {dateLabel}</p>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
            isResolved ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-orange-700'
          }`}>
            {isResolved ? 'טופל' : 'פתוח'}
          </span>
        </div>
        <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{message}</p>
      </div>

      {confirmDelete ? (
        <div className="border-t border-red-100 bg-red-50 px-4 py-3">
          <p className="text-xs text-red-700 font-medium mb-2 text-center">למחוק את הפנייה?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={working}
              className="flex-1 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 bg-white disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              onClick={handleDelete}
              disabled={working}
              className="flex-1 py-2 bg-red-600 text-white rounded-xl text-xs font-medium disabled:opacity-50"
            >
              {working ? 'מוחק...' : 'מחק'}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-gray-50 px-4 py-2.5 flex items-center justify-between">
          <button
            onClick={toggleStatus}
            disabled={working}
            className="text-xs font-medium text-gray-500 active:text-gray-700 disabled:opacity-50"
          >
            {working ? '...' : isResolved ? 'סמן כפתוח' : 'סמן כטופל'}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs font-medium text-red-400 active:text-red-600"
          >
            מחק
          </button>
        </div>
      )}
    </div>
  )
}
