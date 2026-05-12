export type ShareResult =
  | { status: 'shared' }
  | { status: 'cancelled' }
  | { status: 'fallback'; filename: string }
  | { status: 'error'; message: string }

// Strips characters forbidden in filenames across platforms/WhatsApp.
// Keeps Hebrew, Latin, digits, spaces, and hyphens intact.
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
  const fetched = await fetchPdfBlob(quoteId)
  if (!fetched.ok) return { status: 'error', message: fetched.message }

  const { blob } = fetched
  const filename = buildPdfFilename(quoteNumber, clientName)

  const title = 'הצעת מחיר'
  const textLines: string[] = []
  if (clientName) textLines.push(`לכבוד: ${clientName}`)
  textLines.push(
    companyName
      ? `מצורפת הצעת מחיר מטעם ${companyName}`
      : 'מצורפת הצעת מחיר'
  )
  const text = textLines.join('\n')

  const file = new File([blob], filename, { type: 'application/pdf' })

  // Use the actual file for canShare — a 0-byte dummy returns false on iOS
  // even when the real PDF can be shared.
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })

  if (canShareFiles) {
    try {
      await navigator.share({ title, text, files: [file] })
      return { status: 'shared' }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { status: 'cancelled' }
      }
      return { status: 'fallback', filename }
    }
  }

  return { status: 'fallback', filename }
}

// Download via direct API URL — avoids creating blob: URLs that iOS/PWA
// would navigate to, exposing the blob URL to the system share sheet.
export function triggerApiDownload(quoteId: string, filename: string): void {
  const a = document.createElement('a')
  a.href = `/api/quotes/${quoteId}/pdf`
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
