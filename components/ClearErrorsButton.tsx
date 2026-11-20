'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Admin-only (enforced by RLS on app_errors): deletes all logged errors.
export function ClearErrorsButton() {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)
  const [failed, setFailed] = useState(false)

  const clearAll = async () => {
    setWorking(true)
    setFailed(false)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('app_errors').delete().not('id', 'is', null)
    setWorking(false)
    setConfirming(false)
    if (error) {
      setFailed(true)
      return
    }
    router.refresh()
  }

  if (!confirming) {
    return (
      <div className="flex items-center gap-2">
        {failed && <span className="text-xs text-red-500">הניקוי נכשל</span>}
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg active:bg-gray-50"
        >
          נקה הכל
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600">למחוק את כל השגיאות?</span>
      <button type="button" onClick={() => setConfirming(false)} disabled={working}
        className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1.5 rounded-lg disabled:opacity-50">
        ביטול
      </button>
      <button type="button" onClick={clearAll} disabled={working}
        className="text-xs text-white bg-red-600 px-2.5 py-1.5 rounded-lg disabled:opacity-50">
        {working ? 'מוחק...' : 'מחק'}
      </button>
    </div>
  )
}
