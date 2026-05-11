'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { shareQuotePdf, triggerApiDownload } from '@/lib/share/shareQuotePdf'

interface Props {
  quoteId: string
  quoteNumber: string | null
  companyName: string
  clientName?: string | null
}

export function PdfShareButton({ quoteId, quoteNumber, companyName, clientName }: Props) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading'>('idle')

  const handleShare = async () => {
    setState('loading')
    const result = await shareQuotePdf(quoteId, quoteNumber, companyName, clientName)
    if (result.status === 'fallback') {
      // Use direct API URL — avoids blob: URLs that can leak into the iOS share sheet
      triggerApiDownload(quoteId, result.filename)
    } else if (result.status === 'error') {
      router.push(`/quotes/${quoteId}/pdf-view`)
    }
    setState('idle')
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={state === 'loading'}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold active:bg-orange-700 disabled:opacity-60 transition-colors whitespace-nowrap"
    >
      {state === 'loading' ? (
        'מכין...'
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
