// MCP server for AI agents (Instinct, Meta Muse, Claude…). Server-only.
// One McpServer per request (stateless). Every call runs as the token owner:
// reads follow the same visibility as RLS (users: own quotes; admin/manager/
// viewer: all), writes only create drafts or add items to the owner's drafts.
// Nothing here sends, deletes or changes a quote's status.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/errorLog'
import { todayIso } from '@/lib/dates'
import { quoteTotal, type TotalsItem } from '@/lib/quoteTotals'
import { formatRevisionNumber } from '@/lib/revisionNumber'
import { parseNotes } from '@/lib/notesFormat'
import type { TokenAuth } from '@/lib/apiTokens'
import { draftInputShape, itemInput, buildQuoteRow, buildItemRows, clientNameKey, type DraftInput, type ItemInput } from './draft'

const STATUS_HE: Record<string, string> = {
  draft: 'טיוטה', sent: 'נשלחה', accepted: 'אושרה', rejected: 'נדחתה', archived: 'בארכיון',
}

const INSTRUCTIONS = `Field Quotes — price quotes for "נתן ולדמן ובניו" (construction/infrastructure, Eilat, Israel). Data and replies are in Hebrew.
- Use create_quote_draft to turn the user's spoken/written job description into a DRAFT quote; the user reviews, prices and sends it in the app. You cannot send, delete or change status.
- Before pricing, call search_past_items to reuse prices/units of similar past work. If no price is known, leave unit_price out (0) rather than guessing, and tell the user which items need prices.
- Use search_clients to match the client name exactly as stored, so the quote links to the right client.
- Split the job into clear items (one action per item), Hebrew descriptions, realistic units (מ״א, מ״ר, מ״ק, יח׳, קומפלט).
- After creating, give the user the quote number and the edit link.`

type Ctx = TokenAuth & { origin: string }

const esc = (q: string) => q.replace(/[%_\\]/g, (m) => '\\' + m)
const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] })
const fail = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true })
const ils = (n: number) => `₪${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function buildMcpServer(ctx: Ctx): McpServer {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any
  const canSeeAll = ['admin', 'manager', 'viewer'].includes(ctx.role)
  const canWrite = ctx.role !== 'viewer'

  const server = new McpServer(
    { name: 'field-quotes', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  )

  // Wraps a tool body: logs unexpected errors to app_errors, returns a clean error
  const safe = <A>(tool: string, fn: (args: A) => Promise<ReturnType<typeof ok>>) =>
    async (args: A) => {
      try {
        return await fn(args)
      } catch (err) {
        await logServerError(err, { route: '/api/mcp', userId: ctx.userId, context: { kind: 'mcp', tool } })
        return fail('שגיאה פנימית בביצוע הפעולה. הבעיה נרשמה במערכת.')
      }
    }

  const visibleQuotes = (select: string) => {
    let q = db.from('quotes').select(select)
    if (!canSeeAll) q = q.eq('user_id', ctx.userId)
    return q
  }

  async function defaultContactFor(name: string): Promise<string | null> {
    const key = clientNameKey(name)
    const { data: byName } = await db.from('clients').select('contact').eq('name_key', key).maybeSingle()
    if (byName) return byName.contact || null
    const { data: byAlias } = await db.from('clients').select('contact').contains('alias_keys', [key]).limit(1)
    return byAlias?.[0]?.contact || null
  }

  // ── search_clients ──────────────────────────────────────────────────────
  server.registerTool(
    'search_clients',
    {
      title: 'Search clients',
      description: 'Find existing clients by (part of) name or contact. Returns exact stored names to use in create_quote_draft.',
      inputSchema: { query: z.string().trim().min(1).max(100) },
      annotations: { readOnlyHint: true },
    },
    safe('search_clients', async ({ query }: { query: string }) => {
      const pattern = `%${esc(query)}%`
      const { data } = await db
        .from('clients')
        .select('name, contact')
        .or(`name.ilike.${JSON.stringify(pattern)},contact.ilike.${JSON.stringify(pattern)}`)
        .order('name')
        .limit(10)
      const rows = (data ?? []) as Array<{ name: string; contact: string }>
      if (rows.length === 0) return ok(`לא נמצאו לקוחות עבור "${query}". לקוח חדש ייווצר אוטומטית בשמירת ההצעה.`)
      return ok(rows.map((r) => `• ${r.name}${r.contact ? ` — איש קשר: ${r.contact}` : ''}`).join('\n'))
    }),
  )

  // ── search_past_items ───────────────────────────────────────────────────
  server.registerTool(
    'search_past_items',
    {
      title: 'Search past quote items',
      description: 'Find items from previous quotes whose description contains the given words — use to reuse prices, units and wording.',
      inputSchema: {
        query: z.string().trim().min(2).max(100).describe('Words from the work description, e.g. "חפירת תעלה" or "שרוול 75".'),
        limit: z.number().int().min(1).max(30).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    safe('search_past_items', async ({ query, limit }: { query: string; limit?: number }) => {
      let q = db
        .from('quote_items')
        .select('description, unit, quantity, unit_price, created_at, quotes!inner(quote_number, quote_date, client_name, user_id, pricing_mode)')
        .ilike('description', `%${esc(query)}%`)
        .order('created_at', { ascending: false })
        .limit(limit ?? 15)
      if (!canSeeAll) q = q.eq('quotes.user_id', ctx.userId)
      const { data } = await q
      const rows = (data ?? []) as Array<{
        description: string; unit: string; quantity: number; unit_price: number
        quotes: { quote_number: string | null; quote_date: string; client_name: string; pricing_mode: string | null }
      }>
      if (rows.length === 0) return ok(`לא נמצאו סעיפים קודמים עם "${query}".`)
      return ok(rows.map((r) => {
        // Lump-sum quotes have no per-item price — don't present ₪0 as a price
        const price = r.quotes.pricing_mode === 'overall'
          ? 'ללא מחיר לסעיף (הצעה במחיר כולל)'
          : Number(r.unit_price) > 0 ? `× ${ils(Number(r.unit_price))}` : 'ללא מחיר'
        return `• ${r.description.replace(/\s*\n\s*/g, ' / ')}\n  ${r.quantity} ${r.unit} ${price} — הצעה ${r.quotes.quote_number ?? '—'} (${r.quotes.client_name}, ${r.quotes.quote_date})`
      }).join('\n'))
    }),
  )

  // ── list_recent_quotes ──────────────────────────────────────────────────
  server.registerTool(
    'list_recent_quotes',
    {
      title: 'List recent quotes',
      description: 'Latest quotes with number, client, status and total (incl. VAT).',
      inputSchema: {
        limit: z.number().int().min(1).max(20).optional(),
        status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'archived']).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    safe('list_recent_quotes', async ({ limit, status }: { limit?: number; status?: string }) => {
      let q = visibleQuotes('id, quote_number, revision_number, client_name, client_address, status, quote_date, pricing_mode, manual_total, price_adjustments, vat_percentage, quote_items(quantity, unit_price, is_optional)')
        .order('created_at', { ascending: false })
        .limit(limit ?? 10)
      if (status) q = q.eq('status', status)
      const { data } = await q
      const rows = (data ?? []) as Array<Record<string, unknown>>
      if (rows.length === 0) return ok('אין הצעות.')
      return ok(rows.map((r) =>
        `• ${r.quote_number ?? '—'} ${formatRevisionNumber(r.revision_number as number)} | ${r.client_name} | ${r.client_address ?? ''} | ${STATUS_HE[r.status as string] ?? r.status} | ${r.quote_date} | ${ils(quoteTotal(r, (r.quote_items ?? []) as TotalsItem[]))}`,
      ).join('\n'))
    }),
  )

  // ── get_quote ───────────────────────────────────────────────────────────
  server.registerTool(
    'get_quote',
    {
      title: 'Get quote',
      description: 'Full details of one quote by its number (e.g. "20112026-01"): client, items, total and edit link.',
      inputSchema: { quote_number: z.string().trim().min(3).max(40) },
      annotations: { readOnlyHint: true },
    },
    safe('get_quote', async ({ quote_number }: { quote_number: string }) => {
      const { data: q } = await visibleQuotes('*, quote_items(item_number, description, unit, quantity, unit_price, notes, is_optional)')
        .eq('quote_number', quote_number)
        .maybeSingle()
      if (!q) return fail(`הצעה ${quote_number} לא נמצאה.`)
      const items = ((q.quote_items ?? []) as Array<Record<string, unknown>>)
        .sort((a, b) => (a.item_number as number) - (b.item_number as number))
      const lines = items.map((i) => {
        const notes = parseNotes(i.notes as string).map((p) => p.text).filter(Boolean).join(' / ')
        return `${i.item_number}. ${String(i.description).replace(/\s*\n\s*/g, ' / ')} — ${i.quantity} ${i.unit} × ${ils(Number(i.unit_price))}${i.is_optional ? ' (אופציה)' : ''}${notes ? `\n   הערה: ${notes}` : ''}`
      })
      return ok([
        `הצעה ${q.quote_number} ${formatRevisionNumber(q.revision_number)} — ${STATUS_HE[q.status] ?? q.status}`,
        `לקוח: ${q.client_name} | כתובת: ${q.client_address ?? ''} | איש קשר: ${q.client_contact ?? ''}`,
        `תאריך: ${q.quote_date} | בתוקף עד: ${q.valid_until ?? '—'} | מע״מ: ${q.vat_percentage}%`,
        '', ...lines, '',
        `סה״כ (כולל התאמות ומע״מ, בלי אופציות): ${ils(quoteTotal(q, items as unknown as TotalsItem[]))}`,
        `עריכה: ${ctx.origin}/quotes/${q.id}/edit`,
      ].join('\n'))
    }),
  )

  // ── create_quote_draft ──────────────────────────────────────────────────
  server.registerTool(
    'create_quote_draft',
    {
      title: 'Create quote draft',
      description: 'Create a new DRAFT quote with items. The user reviews and sends it in the app. Returns the quote number and edit link.',
      inputSchema: draftInputShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    safe('create_quote_draft', async (input: DraftInput) => {
      if (!canWrite) return fail('למשתמש עם הרשאת צפייה בלבד אין אפשרות ליצור הצעות.')
      const row = buildQuoteRow(input, {
        userId: ctx.userId,
        today: todayIso(),
        defaultContact: input.client_contact ? null : await defaultContactFor(input.client_name),
      })
      const { data: created, error } = await db.from('quotes').insert(row).select('id, quote_number').single()
      if (error || !created) throw new Error(`quote insert failed: ${error?.message ?? 'no row'}`)

      const items = buildItemRows(created.id, input.items)
      const { error: itemsErr } = await db.from('quote_items').insert(items)
      if (itemsErr) {
        await db.from('quotes').delete().eq('id', created.id)
        throw new Error(`items insert failed: ${itemsErr.message}`)
      }
      const total = quoteTotal(row, items)
      const unpriced = items.filter((i) => !i.unit_price).length
      return ok([
        `נוצרה טיוטת הצעה ${created.quote_number} ללקוח "${row.client_name}" עם ${items.length} סעיפים.`,
        `סה״כ כרגע: ${ils(total)}${row.vat_percentage ? ' כולל מע״מ' : ' לפני מע״מ'}.`,
        unpriced ? `${unpriced} סעיפים בלי מחיר — יש לתמחר אותם באפליקציה.` : '',
        `לעריכה ושליחה: ${ctx.origin}/quotes/${created.id}/edit`,
      ].filter(Boolean).join('\n'))
    }),
  )

  // ── add_items_to_quote ──────────────────────────────────────────────────
  server.registerTool(
    'add_items_to_quote',
    {
      title: 'Add items to a draft quote',
      description: 'Append items to an existing DRAFT quote (by number). Sent/approved quotes cannot be changed here.',
      inputSchema: {
        quote_number: z.string().trim().min(3).max(40),
        items: z.array(itemInput).min(1).max(100),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    safe('add_items_to_quote', async ({ quote_number, items }: { quote_number: string; items: ItemInput[] }) => {
      if (!canWrite) return fail('למשתמש עם הרשאת צפייה בלבד אין אפשרות לשנות הצעות.')
      const { data: q } = await visibleQuotes('id, user_id, status, quote_number, quote_items(item_number)')
        .eq('quote_number', quote_number)
        .maybeSingle()
      if (!q) return fail(`הצעה ${quote_number} לא נמצאה.`)
      if (q.status !== 'draft') return fail(`הצעה ${quote_number} אינה טיוטה (${STATUS_HE[q.status] ?? q.status}) — אפשר להוסיף סעיפים רק לטיוטות.`)
      if (q.user_id !== ctx.userId && !['admin', 'manager'].includes(ctx.role)) return fail('אין הרשאה לשנות הצעה של משתמש אחר.')
      const next = Math.max(0, ...((q.quote_items ?? []) as Array<{ item_number: number }>).map((i) => i.item_number)) + 1
      const rows = buildItemRows(q.id, items, next)
      const { error } = await db.from('quote_items').insert(rows)
      if (error) throw new Error(`items insert failed: ${error.message}`)
      return ok(`נוספו ${rows.length} סעיפים להצעה ${quote_number} (מספרים ${next}–${next + rows.length - 1}).\nלעריכה: ${ctx.origin}/quotes/${q.id}/edit`)
    }),
  )

  return server
}
