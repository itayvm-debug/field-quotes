'use client'

import { useState } from 'react'
import { prepareQuotePdfFile, sharePreparedFile, type PreparedShare } from '@/lib/share/shareQuotePdf'

interface Props {
  quoteId: string
  quoteNumber: string | null
  companyName: string
  clientName?: string | null
}

type State = 'idle' | 'preparing' | 'ready' | 'sharing' | 'error' | 'no-support'

export function PdfShareButton({ quoteId, quoteNumber, companyName, clientName }: Props) {
  const [state, setState] = useState<State>('idle')
  const [prepared, setPrepared] = useState<PreparedShare | null>(null)

  // Tap 1 — fetch PDF. No navigator.share here.
  const handlePrepare = async () => {
    setState('preparing')
    try {
      const p = await prepareQuotePdfFile(quoteId, quoteNumber, clientName, companyName)
      setPrepared(p)
      setState('ready')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  // Tap 2 — must be called synchronously inside a click handler (no awaits before navigator.share).
  const handleShareNow = () => {
    if (!prepared) return
    setState('sharing')
    sharePreparedFile(prepared).then((result) => {
      if (result.status === 'cancelled') {
        setState('ready') // keep file ready so user can try a different app
      } else if (result.status === 'no-support') {
        setState('no-support')
        setPrepared(null)
      } else if (result.status === 'error') {
        setState('error')
        setTimeout(() => { setState('idle'); setPrepared(null) }, 3000)
      } else {
        setState('idle')
        setPrepared(null)
      }
    })
  }

  if (state === 'no-support') {
    return (
      <div className="flex flex-col items-center gap-1 text-center max-w-[180px]">
        <p className="text-xs text-gray-500 leading-relaxed">
          שיתוף ישיר אינו נתמך.
          <br />ניתן להוריד ולשלוח ידנית.
        </p>
        <button type="button" onClick={() => { setState('idle'); setPrepared(null) }}
          className="text-xs text-gray-400 underline">
          סגור
        </button>
      </div>
    )
  }

  // Tap 2 button — rendered separately so its onClick calls navigator.share with no prior awaits
  if (state === 'ready' && prepared) {
    return (
      <button
        type="button"
        onClick={handleShareNow}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold active:bg-blue-700 whitespace-nowrap"
      >
        שתף עכשיו
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={state === 'idle' ? handlePrepare : undefined}
      disabled={state !== 'idle'}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-colors whitespace-nowrap ${
        state === 'error' ? 'bg-red-500 active:bg-red-600' : 'bg-orange-600 active:bg-orange-700'
      }`}
    >
      {state === 'preparing' ? 'מכין...' :
       state === 'sharing' ? 'משתף...' :
       state === 'error' ? 'שגיאה' : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          שתף PDF
        </>
      )}
    </button>
  )
}
