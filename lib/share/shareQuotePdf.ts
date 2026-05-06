export type ShareResult =
  | { status: 'shared' }
  | { status: 'cancelled' }
  | { status: 'fallback'; blob: Blob; filename: string }
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
): Promise<ShareResult> {
  const fetched = await fetchPdfBlob(quoteId, quoteNumber)
  if (!fetched.ok) return { status: 'error', message: fetched.message }

  const { blob, filename } = fetched
  const file = new File([blob], filename, { type: 'application/pdf' })

  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })

  if (canShareFiles) {
    try {
      await navigator.share({
        title: `הצעת מחיר ${quoteNumber ?? ''}`.trim(),
        text: companyName ? `הצעת מחיר מטעם ${companyName}` : 'הצעת מחיר',
        files: [file],
      })
      return { status: 'shared' }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { status: 'cancelled' }
      }
      // Share failed (e.g. file too large, browser restriction) — fall back to download
      return { status: 'fallback', blob, filename }
    }
  }

  return { status: 'fallback', blob, filename }
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
