// Browser helper: sends an error to /api/client-error (stored in app_errors).
// Fire-and-forget; never throws.
export function reportClientError(
  message: string,
  extra: { details?: string | null; context?: Record<string, unknown> } = {}
): void {
  try {
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message,
        route: typeof window !== 'undefined' ? window.location.pathname : null,
        details: extra.details ?? null,
        context: extra.context ?? {},
      }),
    }).catch(() => {})
  } catch {
    // ignore
  }
}
