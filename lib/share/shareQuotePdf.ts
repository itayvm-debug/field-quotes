export type ShareResult =
  | { status: 'shared' }
  | { status: 'cancelled' }
  | { status: 'fallback'; filename: string }
  | { status: 'error'; message: string }

async function fetchPdfBlob(
  quoteId: string,
  quoteNumber: string | null,
): Promise<{ ok: true; blob: Blob; filename: string } | { ok: false; message: string }> {
  try {
    const res = await fetch(`/api/quotes/${quoteId}/pdf`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const filename = `quote-${quoteNumber ?? quoteId.slice(0, 8)}.pdf`
    return { ok: true, blob, filename }
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
  const fetched = await fetchPdfBlob(quoteId, quoteNumber)
  if (!fetched.ok) return { status: 'error', message: fetched.message }

  const { blob, filename } = fetched

  const titleText = quoteNumber
    ? `הצעת מחיר מספר ${quoteNumber}`
    : 'הצעת מחיר'

  const textLines: string[] = [
    companyName ? `הצעת מחיר מטעם ${companyName}` : 'הצעת מחיר',
  ]
  if (quoteNumber) textLines.push(`מספר הצעה: ${quoteNumber}`)
  if (clientName) textLines.push(`לכבוד: ${clientName}`)
  const shareText = textLines.join('\n')

  const file = new File([blob], filename, { type: 'application/pdf' })

  // Use a minimal dummy file for the capability check so the actual share
  // file object is not touched until navigator.share() — avoids any
  // internal browser URL association that could leak into the share sheet.
  const dummyFile = new File([''], filename, { type: 'application/pdf' })
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [dummyFile] })

  if (canShareFiles) {
    try {
      await navigator.share({ title: titleText, text: shareText, files: [file] })
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
