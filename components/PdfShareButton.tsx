'use client'

import { useState } from 'react'
import { shareQuotePdf } from '@/lib/share/shareQuotePdf'

interface Props {
  quoteId: string
  quoteNumber: string | null
  companyName: string
  clientName?: string | null
}

export function PdfShareButton({ quoteId, quoteNumber, companyName, clientName }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'unsupported' | 'error'>('idle')

  const handleShare = async () => {
    setState('loading')
    const result = await shareQuotePdf(quoteId, quoteNumber, companyName, clientName)
    if (result.status === 'shared' || result.status === 'cancelled') {
      setState('idle')
    } else if (result.status === 'no-support') {
      setState('unsupported')
    } else {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  if (state === 'unsupported') {
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs text-gray-500 leading-relaxed">
          שיתוף ישיר אינו נתמך במכשיר זה.
          <br />ניתן להוריד את ה-PDF ולשלוח ידנית.
        </p>
        <button
          type="button"
          onClick={() => setState('idle')}
          className="text-xs text-gray-400 underline"
        >
          סגור
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={state === 'loading'}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-colors whitespace-nowrap ${
        state === 'error' ? 'bg-red-500 active:bg-red-600' : 'bg-orange-600 active:bg-orange-700'
      }`}
    >
      {state === 'loading' ? (
        'מכין...'
      ) : state === 'error' ? (
        'שגיאה — נסה שוב'
      ) : (
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
