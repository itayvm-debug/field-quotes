// Server-only: records errors in public.app_errors (see migration 019) so they
// outlive Vercel's ~30 min log retention. Shown to admins on /admin/errors.
// Never throws — logging must not break the request that failed.
import { createAdminClient } from '@/lib/supabase/admin'

const RETENTION_DAYS = 90

export interface ErrorLogInfo {
  source?: 'server' | 'client'
  route?: string | null
  userId?: string | null
  context?: Record<string, unknown>
}

const cut = (s: string | null | undefined, max: number) =>
  s == null ? null : s.length > max ? s.slice(0, max) + '…' : s

export function describeError(err: unknown): { message: string; details: string | null } {
  if (err instanceof Error) {
    const digest = (err as Error & { digest?: string }).digest
    return {
      message: err.message || err.name,
      details: [digest ? `digest: ${digest}` : null, err.stack ?? null].filter(Boolean).join('\n') || null,
    }
  }
  return { message: typeof err === 'string' ? err : JSON.stringify(err) ?? String(err), details: null }
}

export async function logServerError(err: unknown, info: ErrorLogInfo = {}): Promise<void> {
  const { message, details } = describeError(err)
  console.error(`[app-error] ${info.route ?? ''} ${message}`)
  try {
    let context = info.context ?? {}
    if (JSON.stringify(context).length > 4000) context = { truncated: true }
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('app_errors').insert({
      source: info.source ?? 'server',
      route: cut(info.route?.split('?')[0] ?? null, 300),
      message: cut(message, 1000) ?? 'unknown error',
      details: cut(details, 4000),
      user_id: info.userId ?? null,
      context,
    })
    // Occasional pruning keeps the table small without a scheduled job
    if (Math.random() < 0.05) {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('app_errors').delete().lt('created_at', cutoff)
    }
  } catch (logErr) {
    console.error('[app-error] failed to record error', logErr)
  }
}
