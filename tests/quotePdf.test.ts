import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import {
  QuotePDF, resetPdfFonts, fixRtlText, stripBidiControlChars,
  type PdfItem, type PdfQuote, type QuotePDFProps,
} from '@/lib/pdf/QuotePDF'

const RLI = '⁧', PDI = '⁩', LRM = '‎', RLM = '‏'
const BIDI_CONTROLS = /[‎‪-‮⁦-⁩]/

const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(process.cwd(), 'public', 'company-logo.png')).toString('base64')

const company = {
  company_name: 'חברת בדיקה בע"מ', company_id_number: '000000000', address: 'אילת',
  phone: '08-0000000', email: 'test@example.com', footer_text: 'חברת בדיקה | 08-0000000',
}

const baseQuote: PdfQuote = {
  quote_number: '20112026-01', revision_number: 1, status: 'draft',
  client_name: 'לקוח בדיקה', client_address: 'מסוף רבין', client_contact: `בודק ${LRM}050-0000000`,
  project_description: `עבודות תשתית ${RLI}טקסט מודבק${PDI}`,
  quote_date: '2026-11-20', valid_until: '2027-01-19',
  payment_terms: `שוטף + 30 ${RLI}(הערה)${PDI}`,
  exclusions: 'ההצעה אינה כוללת עבודות שלא צוינו במפורש.\nההצעה כפופה לאישור המזמין.',
  vat_percentage: 18,
  price_adjustments: [
    { id: 'a', type: 'addition', name: 'תוספת אילת', valueType: 'percentage', percentage: 2.5 },
    { id: 'b', type: 'discount', name: 'הנחה', valueType: 'fixed', fixedAmount: 120.75 },
  ],
  pricing_mode: 'items', manual_total: null,
}

const item = (n: number, extra: Partial<PdfItem> = {}): PdfItem => ({
  item_number: n,
  description: `סעיף ${n}: ניסור ופירוק אספלט, חפירה תעלה 12 מטר אורך והנחת שרוולים 50+75 שרשורי`,
  unit: 'קומפלט', quantity: 1, unit_price: 1000 + n, notes: '', is_optional: false, images: [],
  ...extra,
})

const shortItems: PdfItem[] = [
  item(1, { description: `סעיף ${RLI}מודבק${PDI} עם **הדגשה**` }),
  item(2, { is_optional: true, notes: JSON.stringify([{ text: 'ללא חציבת יסוד עמוד', bold: false }]) }),
]
// Long enough for several pages, with notes on some items (the shape that crashed in production)
const longItems: PdfItem[] = Array.from({ length: 26 }, (_, i) =>
  item(i + 1, i % 4 === 0 ? { notes: JSON.stringify([{ text: 'הערה לסעיף עם פרטים נוספים לבדיקת גובה', bold: false }]) } : {}),
)

async function render(props: Partial<QuotePDFProps> & { items: PdfItem[] }): Promise<Buffer> {
  // Same order as the API route: fresh fonts right before rendering
  resetPdfFonts()
  const el = React.createElement(QuotePDF, {
    quote: baseQuote, company, logoUrl: logo,
    creator: { full_name: 'בודק מערכת', job_title: '', signature_url: null },
    ...props,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(el as any)
}

const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length

describe('BiDi text helpers', () => {
  it('stripBidiControlChars removes LRM/RLM, embeddings and isolates', () => {
    expect(stripBidiControlChars(`א${LRM}ב${RLM}ג${RLI}ד${PDI}ה‫ו‬`)).toBe('אבגדהו')
  })
  it('fixRtlText strips pasted controls and appends exactly one RLM per non-empty line', () => {
    const out = fixRtlText(`שורה ${RLI}אחת${PDI}.\n\nשורה שתיים`)
    expect(out).toBe(`שורה אחת.${RLM}\n\nשורה שתיים${RLM}`)
    expect(BIDI_CONTROLS.test(out)).toBe(false)
  })
})

describe('QuotePDF rendering', () => {
  it('renders a short quote (adjustments, optional item, pasted BiDi chars) on one page', async () => {
    const pdf = await render({ items: shortItems })
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    expect(pageCount(pdf)).toBe(1)
  })

  it('renders overall (lump-sum) pricing mode', async () => {
    const pdf = await render({
      quote: { ...baseQuote, pricing_mode: 'overall', manual_total: 38500 },
      items: shortItems,
    })
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('paginates a long quote across several pages', async () => {
    const pdf = await render({ items: longItems })
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(3)
  })

  it('renders an empty quote and one without a creator', async () => {
    expect(pageCount(await render({ items: [] }))).toBe(1)
    expect(pageCount(await render({ items: shortItems, creator: null }))).toBe(1)
  })

  // Regression: in a warm server instance a long quote rendered after a short
  // one crashed with "Cannot read properties of undefined (reading 'id')"
  // (fontkit glyph cache). resetPdfFonts() before each render prevents it.
  it('renders short and long quotes back-to-back in one process', async () => {
    for (const items of [shortItems, longItems, shortItems, longItems, longItems]) {
      const pdf = await render({ items })
      expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    }
  })
})
