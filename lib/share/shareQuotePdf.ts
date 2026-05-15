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

// Single source of truth for PDF filenames — used by the API route (Content-Disposition),
// share helper (File object), and download helper.
// Format: natan-valdman-price-quote-{quoteNumber}.pdf
export function buildQuotePdfFilename(quoteNumber: string | null | undefined): string {
  const num = quoteNumber ? quoteNumber.replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 60) : ''
  return num ? `natan-valdman-price-quote-${num}.pdf` : 'natan-valdman-price-quote.pdf'
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

  // arrayBuffer guarantees raw bytes; res.blob() may return empty MIME type on some browsers/iOS.
  const arrayBuffer = await res.arrayBuffer()

  // Validate that the response is actually a PDF (not an HTML error page or empty body).
  const magic = new TextDecoder().decode(arrayBuffer.slice(0, 4))
  if (magic !== '%PDF') {
    console.error('[shareQuotePdf] not a PDF — magic bytes:', JSON.stringify(magic), 'status:', res.status, 'content-type:', res.headers.get('content-type'))
    throw new Error('Response is not a valid PDF')
  }

  const pdfBlob = new Blob([arrayBuffer], { type: 'application/pdf' })
  const filename = buildQuotePdfFilename(quoteNumber)
  const file = new File([pdfBlob], filename, { type: 'application/pdf' })

  // Diagnostics — intentionally not gated by NODE_ENV so they appear in production Safari console.
  console.log('[shareQuotePdf]', {
    responseStatus: res.status,
    responseContentType: res.headers.get('content-type'),
    blobType: pdfBlob.type,
    blobSize: pdfBlob.size,
    fileName: filename,
    fileType: file.type,
    fileSize: file.size,
  })

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
export function triggerApiDownload(quoteId: string, quoteNumber?: string | null): void {
  const a = document.createElement('a')
  a.href = `/api/quotes/${quoteId}/pdf`
  a.download = buildQuotePdfFilename(quoteNumber)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
