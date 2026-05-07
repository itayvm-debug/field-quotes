export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PdfShareButton } from '@/components/PdfShareButton'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PdfViewPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: quote }, { data: settings }] = await Promise.all([
    supabase.from('quotes').select('quote_number, client_name').eq('id', id).single(),
    supabase.from('company_settings').select('company_name').single(),
  ])

  if (!quote) notFound()

  const pdfUrl = `/api/quotes/${id}/pdf`
  const title = [quote.quote_number, quote.client_name].filter(Boolean).join(' — ')
  const companyName = settings?.company_name ?? ''

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        {/* Back */}
        <Link
          href={`/quotes/${id}`}
          className="flex items-center gap-1 text-sm font-medium text-gray-600 active:text-gray-900 shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          חזרה להצעה
        </Link>

        {/* Title */}
        <span className="text-sm font-semibold text-gray-900 truncate flex-1 text-center">
          {title}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={pdfUrl}
            download
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold active:bg-gray-50 whitespace-nowrap"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            הורד
          </a>
          <PdfShareButton
            quoteId={id}
            quoteNumber={quote.quote_number}
            companyName={companyName}
          />
        </div>
      </div>

      {/* ── PDF embed ────────────────────────────────────────────────── */}
      <div className="p-3 md:p-6 max-w-5xl mx-auto">
        <iframe
          src={pdfUrl}
          className="w-full rounded-xl shadow-sm border border-gray-200 bg-white"
          style={{ height: '78vh' }}
          title={`PDF — ${title}`}
        />

        {/* Fallback for browsers / iOS PWA that can't embed PDFs */}
        <div className="mt-3 text-center">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 underline"
          >
            לא ניתן לצפות? פתח PDF בחלון נפרד
          </a>
        </div>
      </div>
    </div>
  )
}
