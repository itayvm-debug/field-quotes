import { describe, it, expect } from 'vitest'
import { buildQuoteRow, buildItemRows, clientNameKey, notesToStored, draftInput } from '@/lib/mcp/draft'
import { generateToken, hashToken, isWellFormedToken, tokenDisplayPrefix } from '@/lib/apiTokens'
import { parseNotes } from '@/lib/notesFormat'
import { DEFAULT_EXCLUSIONS } from '@/types'

describe('MCP draft builders', () => {
  const input = draftInput.parse({
    client_name: '  רשות שדות התעופה ',
    client_address: 'מסוף רבין',
    items: [
      { description: 'חפירת תעלה', unit: 'מ״א', quantity: 12, unit_price: 350, notes: 'שורה 1\nשורה 2' },
      { description: 'הנחת שרוול 75', is_optional: true },
    ],
    include_vat: true,
  })

  it('builds a draft quote row with form defaults', () => {
    const row = buildQuoteRow(input, { userId: 'u1', today: '2026-11-20', defaultContact: 'ים מרציאנו' })
    expect(row).toMatchObject({
      user_id: 'u1', status: 'draft', client_name: 'רשות שדות התעופה', client_address: 'מסוף רבין',
      client_contact: 'ים מרציאנו', quote_date: '2026-11-20', valid_until: '2027-01-19',
      exclusions: DEFAULT_EXCLUSIONS, vat_percentage: 18, pricing_mode: 'items',
    })
  })

  it('keeps an explicit contact over the client default and VAT off by default', () => {
    const row = buildQuoteRow(
      draftInput.parse({ client_name: 'x', client_contact: 'דני', items: [{ description: 'a' }] }),
      { userId: 'u', today: '2026-11-20', defaultContact: 'ברירת מחדל' },
    )
    expect(row.client_contact).toBe('דני')
    expect(row.vat_percentage).toBe(0)
  })

  it('builds numbered item rows with defaults and stored notes', () => {
    const rows = buildItemRows('q1', input.items, 3)
    expect(rows.map((r) => r.item_number)).toEqual([3, 4])
    expect(rows[1]).toMatchObject({ unit: 'יח׳', quantity: 1, unit_price: 0, is_optional: true, notes: '' })
    expect(parseNotes(rows[0].notes).map((p) => p.text)).toEqual(['שורה 1', 'שורה 2'])
  })

  it('normalizes client names like the DB', () => {
    expect(clientNameKey('  רשות   שדות התעופה ')).toBe('רשות שדות התעופה')
    expect(clientNameKey('ABC  Ltd')).toBe('abc ltd')
  })

  it('stores empty notes as empty string', () => {
    expect(notesToStored('   ')).toBe('')
    expect(notesToStored(undefined)).toBe('')
  })

  it('rejects drafts without items or client', () => {
    expect(draftInput.safeParse({ client_name: 'x', items: [] }).success).toBe(false)
    expect(draftInput.safeParse({ client_name: ' ', items: [{ description: 'a' }] }).success).toBe(false)
  })
})

describe('API tokens', () => {
  it('generates well-formed, unique tokens', () => {
    const a = generateToken()
    const b = generateToken()
    expect(isWellFormedToken(a)).toBe(true)
    expect(a).not.toBe(b)
    expect(tokenDisplayPrefix(a)).toHaveLength(7)
  })
  it('hashes deterministically and never returns the token', () => {
    const t = generateToken()
    expect(hashToken(t)).toBe(hashToken(t))
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(t)).not.toContain(t.slice(3))
  })
  it('rejects malformed tokens', () => {
    expect(isWellFormedToken('fq_short')).toBe(false)
    expect(isWellFormedToken('Bearer xyz')).toBe(false)
    expect(isWellFormedToken('')).toBe(false)
  })
})
