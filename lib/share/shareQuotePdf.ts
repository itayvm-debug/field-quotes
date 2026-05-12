export type PreparedShare = {
  file: File
  title: string
  text: string
}

export type ShareResult =
  | { status: 'shared' }
  | { status: 'cancelled' }
  | { status: 'no-support' }
  | { status: 'error'; message: string }

function sanitizePart(s: string): string {
  return s.replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 60)
}

// Hebrew filename — used for download (via Content-Disposition) and iOS share.
export function buildPdfFilename(
  quoteNumber: string | null | undefined,
  clientName?: string | null,
): string {
  const parts: string[] = ['הצעת מחיר']
  if (clientName) {
    const clean = sanitizePart(clientName)
    if (clean) parts.push(clean)
  }
  if (quoteNumber) {
    const clean = sanitizePart(quoteNumber)
    if (clean) parts.push(clean)
  }
  return parts.join(' - ') + '.pdf'
}

// ASCII fallback for desktop Web Share.
// WhatsApp Web on desktop decodes UTF-8 filename bytes as Latin-1, producing garbled text.
// iOS share sheet handles Hebrew correctly so the fallback is only applied on non-mobile.
function buildAsciiFallbackFilename(quoteNumber: string | null | undefined): string {
  const num = quoteNumber ? sanitizePart(quoteNumber) : ''
  return num ? `quote-${num}.pdf` : 'quote.pdf'
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

// Step 1 — fetch PDF and build File. Call this when user first taps the share button.
// Does NOT call navigator.share — safe to await before user activation expires.
export async function prepareQuotePdfFile(
  quoteId: string,
  quoteNumber: string | null | undefined,
  clientName: string | null | undefined,
  companyName: string,
): Promise<PreparedShare> {
  const res = await fetch(`/api/quotes/${quoteId}/pdf`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  // Mobile: Hebrew filename works correctly in iOS/Android share sheet.
  // Desktop: use ASCII fallback — WhatsApp Web garbles non-ASCII filenames.
  const filename = isMobileDevice()
    ? buildPdfFilename(quoteNumber, clientName)
    : buildAsciiFallbackFilename(quoteNumber)
  if (process.env.NODE_ENV === 'development') {
    console.log('[shareQuotePdf] share filename:', filename)
  }
  const file = new File([blob], filename, { type: 'application/pdf' })
  const title = 'הצעת מחיר'
  const textLines: string[] = []
  if (clientName) textLines.push(`לכבוד: ${clientName}`)
  textLines.push(companyName ? `מצורפת הצעת מחיר מטעם ${companyName}` : 'מצורפת הצעת מחיר')
  const text = textLines.join('\n')
  return { file, title, text }
}

// Step 2 — call navigator.share() immediately. Must be invoked synchronously
// inside a click handler with no awaits before it, so user activation is preserved.
export function sharePreparedFile(prepared: PreparedShare): Promise<ShareResult> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return Promise.resolve({ status: 'no-support' })
  }
  if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [prepared.file] })) {
    return Promise.resolve({ status: 'no-support' })
  }
  return navigator
    .share({ title: prepared.title, text: prepared.text, files: [prepared.file] })
    .then((): ShareResult => ({ status: 'shared' }))
    .catch((err): ShareResult => {
      if (err instanceof Error && err.name === 'AbortError') return { status: 'cancelled' }
      console.error('[sharePreparedFile]', err)
      return { status: 'error', message: err instanceof Error ? err.message : String(err) }
    })
}

// Download via direct API URL — never creates blob: URLs
export function triggerApiDownload(quoteId: string, filename: string): void {
  const a = document.createElement('a')
  a.href = `/api/quotes/${quoteId}/pdf`
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
