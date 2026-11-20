// Personal access tokens for AI agents (MCP). Server-only.
// Format: "fq_" + 43 chars base64url (32 random bytes). Only the SHA-256 hash
// is stored (table api_tokens, migration 021).
import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const TOKEN_PREFIX = 'fq_'
const TOKEN_RE = /^fq_[A-Za-z0-9_-]{43}$/
const LAST_USED_THROTTLE_MS = 5 * 60_000

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function isWellFormedToken(token: string): boolean {
  return TOKEN_RE.test(token)
}

// Display hint, e.g. "fq_AbCd…" — never enough to use the token
export function tokenDisplayPrefix(token: string): string {
  return token.slice(0, 7)
}

export function bearerFrom(req: Request): string | null {
  const h = req.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(\S+)$/i.exec(h.trim())
  return m ? m[1] : null
}

export interface TokenAuth {
  userId: string
  role: string
  tokenId: string
  fullName: string
}

// Resolves a bearer token to its active owner, or null.
export async function authenticateToken(token: string | null): Promise<TokenAuth | null> {
  if (!token || !isWellFormedToken(token)) return null
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (admin as any)
    .from('api_tokens')
    .select('id, user_id, last_used_at, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (!row || row.revoked_at) return null

  const { data: profile } = await admin
    .from('profiles')
    .select('role, full_name, is_active')
    .eq('id', row.user_id)
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = profile as any
  if (!p || p.is_active === false) return null

  const last = row.last_used_at ? new Date(row.last_used_at).getTime() : 0
  if (Date.now() - last > LAST_USED_THROTTLE_MS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', row.id)
  }
  return { userId: row.user_id, role: p.role ?? 'user', tokenId: row.id, fullName: p.full_name ?? '' }
}
