'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import Link from 'next/link'
import { reportClientError } from '@/lib/reportClientError'

export default function ProtectedError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    const e = error instanceof Error ? error : new Error(String(error))
    const digest = (e as Error & { digest?: string }).digest
    // Errors with a digest came from the server and were already recorded by
    // instrumentation.ts — report only browser-side errors here.
    if (digest) return
    reportClientError(e.message || 'שגיאה לא ידועה', {
      details: e.stack ?? null,
      context: { kind: 'error-boundary' },
    })
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4" dir="rtl">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-sm w-full text-center space-y-4">
        <h2 className="text-lg font-bold text-gray-900">משהו השתבש</h2>
        <p className="text-sm text-gray-500">התקלה נרשמה במערכת. אפשר לנסות שוב או לחזור לרשימת ההצעות.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => retry()}
            className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold active:bg-orange-700"
          >
            נסה שוב
          </button>
          <Link
            href="/dashboard"
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium active:bg-gray-50"
          >
            לדשבורד
          </Link>
        </div>
      </div>
    </div>
  )
}
