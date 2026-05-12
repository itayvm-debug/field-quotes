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

async function fetchPdfBlob(
  quoteId: string,
): Promise<{ ok: true; blob: Blob } | { ok: false; message: string }> {
  try {
    const res = await fetch(`/api/quotes/${quoteId}/pdf`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    return { ok: true, blob }
  } catch {
    return { ok: false, message: 'שגיאה בהפקת PDF' }
  }
}

export async function shareQuotePdf(
  quoteId: string,
  quoteNumber: string | null,
  companyName: string,
  clientName?: string | null,
): Promise<ShareResult> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return { status: 'no-support' }
  }

  const fetched = await fetchPdfBlob(quoteId)
  if (!fetched.ok) return { status: 'error', message: fetched.message }

  const { blob } = fetched
  const filename = buildPdfFilename(quoteNumber, clientName)
  const file = new File([blob], filename, { type: 'application/pdf' })

  const title = 'הצעת מחיר'
  const textLines: string[] = []
  if (clientName) textLines.push(`לכבוד: ${clientName}`)
  textLines.push(
    companyName
      ? `מצורפת הצעת מחיר מטעם ${companyName}`
      : 'מצורפת הצעת מחיר'
  )
  const text = textLines.join('\n')

  try {
    await navigator.share({ title, text, files: [file] })
    return { status: 'shared' }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { status: 'cancelled' }
    }
    console.error('[shareQuotePdf]', err)
    return { status: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}

// Download via direct API URL — never create blob: URLs
export function triggerApiDownload(quoteId: string, filename: string): void {
  const a = document.createElement('a')
  a.href = `/api/quotes/${quoteId}/pdf`
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
