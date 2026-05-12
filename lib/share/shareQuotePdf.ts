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
  const filename = buildPdfFilename(quoteNumber, clientName)
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
