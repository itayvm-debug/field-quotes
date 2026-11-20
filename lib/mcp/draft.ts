// Pure helpers that turn an AI agent's input into DB rows for a draft quote.
// Kept free of I/O so they are unit-tested (tests/mcpDraft.test.ts).
import { z } from 'zod'
import { serializeNotes } from '@/lib/notesFormat'
import { addDaysIso } from '@/lib/dates'
import { DEFAULT_EXCLUSIONS } from '@/types'

export const VAT_RATE = 18
const DEFAULT_VALID_DAYS = 60 // same as a new quote in the form
const DEFAULT_UNIT = 'יח׳'

export const itemInputShape = {
  description: z.string().trim().min(1).max(5000).describe('Work description (Hebrew). Use line breaks for sub-steps.'),
  unit: z.string().trim().max(50).optional().describe('Unit, e.g. "מ״ר", "מ״א", "קומפלט", "יח׳". Default "יח׳".'),
  quantity: z.number().min(0).max(1_000_000).optional().describe('Quantity. Default 1.'),
  unit_price: z.number().min(0).max(100_000_000).optional().describe('Price per unit in ILS before VAT. Omit or 0 if unknown — the user will price it.'),
  notes: z.string().max(5000).optional().describe('Optional note shown under the item.'),
  is_optional: z.boolean().optional().describe('true = optional item, not included in the total.'),
}
export const itemInput = z.object(itemInputShape)
export type ItemInput = z.infer<typeof itemInput>

export const draftInputShape = {
  client_name: z.string().trim().min(1).max(300).describe('Client name. Matches an existing client when the name is the same.'),
  client_address: z.string().trim().max(500).optional().describe('Site / project address.'),
  client_contact: z.string().trim().max(300).optional().describe("Contact person and phone. If omitted, the client's default contact is used."),
  project_description: z.string().trim().max(2000).optional().describe('Short general description of the project.'),
  items: z.array(itemInput).min(1).max(100).describe('Quote items in order.'),
  include_vat: z.boolean().optional().describe('Add 18% VAT. Default false.'),
  payment_terms: z.string().trim().max(200).optional().describe('e.g. "שוטף + 30". Default empty.'),
}
export const draftInput = z.object(draftInputShape)
export type DraftInput = z.infer<typeof draftInput>

// Same normalization as public.client_name_key() in the DB (migration 020)
export function clientNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function notesToStored(text: string | undefined): string {
  if (!text || !text.trim()) return ''
  return serializeNotes(text.split(/\r?\n/).map((line) => ({ text: line, bold: false })))
}

export function buildItemRows(quoteId: string, items: ItemInput[], firstNumber = 1) {
  return items.map((it, idx) => ({
    quote_id: quoteId,
    item_number: firstNumber + idx,
    description: it.description.trim(),
    unit: it.unit?.trim() || DEFAULT_UNIT,
    quantity: it.quantity ?? 1,
    unit_price: it.unit_price ?? 0,
    notes: notesToStored(it.notes),
    is_optional: it.is_optional ?? false,
  }))
}

export function buildQuoteRow(
  input: DraftInput,
  opts: { userId: string; today: string; defaultContact?: string | null }
) {
  return {
    user_id: opts.userId,
    status: 'draft' as const,
    client_name: input.client_name.trim(),
    client_address: input.client_address?.trim() ?? '',
    client_contact: input.client_contact?.trim() || opts.defaultContact || '',
    project_description: input.project_description?.trim() ?? '',
    quote_date: opts.today,
    valid_until: addDaysIso(opts.today, DEFAULT_VALID_DAYS),
    payment_terms: input.payment_terms?.trim() ?? '',
    exclusions: DEFAULT_EXCLUSIONS,
    vat_percentage: input.include_vat ? VAT_RATE : 0,
    price_adjustments: [],
    pricing_mode: 'items',
  }
}
