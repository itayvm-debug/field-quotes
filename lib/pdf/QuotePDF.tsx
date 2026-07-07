import path from 'path'
import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Font,
  StyleSheet,
} from '@react-pdf/renderer'
import { parseNotes } from '@/lib/notesFormat'
import { applyPriceAdjustments, parsePriceAdjustments } from '@/lib/priceAdjustments'
import type { PriceAdjustment } from '@/lib/priceAdjustments'

// ── Local fonts (bundled in /public/fonts) ────────────────────────────────────
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'Heebo',
  fonts: [
    { src: path.join(FONTS_DIR, 'Heebo-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(FONTS_DIR, 'Heebo-Bold.ttf'), fontWeight: 'bold' },
  ],
})

// ── Company brand colors ──────────────────────────────────────────────────────
const ORANGE = '#E86510'
const BLACK = '#1A1A1A'
const WHITE = '#FFFFFF'
const GRAY_LIGHT = '#F5F5F5'
const GRAY_MID = '#EBEBEB'
const GRAY_TEXT = '#666666'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCurrency = (n: number) => {
  const abs = Math.abs(n)
  const str = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${n < 0 ? '-' : ''}${String.fromCharCode(0x20aa)}${str}`
}

const fmtDate = (s: string | null | undefined) => {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${d || ''}.${m || ''}.${y || ''}`
}

const fixRtlText = (text: string) =>
  text.split('\n').map((line) => (line.trim() ? line + '‏' : line)).join('\n')

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PdfItemImage {
  storage_path: string
  signedUrl: string
  include_in_pdf: boolean
}

export interface PdfItem {
  item_number: number
  description: string
  unit: string
  quantity: number
  unit_price: number
  notes: string
  is_optional?: boolean
  images: PdfItemImage[]
}

export interface PdfQuote {
  quote_number: string | null
  status: string
  client_name: string
  client_address: string
  client_contact: string
  project_description: string
  quote_date: string
  valid_until: string | null
  payment_terms: string
  exclusions: string
  vat_percentage: number
  price_adjustments?: PriceAdjustment[]
}

export interface PdfCompany {
  company_name: string
  company_id_number: string
  address: string
  phone: string
  email: string
  footer_text: string
}

export interface PdfCreator {
  full_name: string
  job_title: string
  signature_url: string | null
}

export interface QuotePDFProps {
  quote: PdfQuote
  items: PdfItem[]
  company: PdfCompany
  logoUrl: string | null
  creator?: PdfCreator | null
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: 'Heebo',
    fontSize: 9,
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
    color: BLACK,
    backgroundColor: WHITE,
  },

  // ── Top header band ─────────────────────────────────────────────────────────
  topBand: {
    backgroundColor: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 10,
    paddingBottom: 6,
  },
  topBandLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  topBandRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  companyName: {
    fontFamily: 'Heebo',
    fontWeight: 'bold',
    fontSize: 13,
    color: BLACK,
    textAlign: 'right',
  },
  companyDetail: {
    fontSize: 8,
    color: GRAY_TEXT,
    textAlign: 'right',
    marginTop: 1,
  },
  logo: {
    height: 54,
    width: 112,
    objectFit: 'contain',
  },

  // ── Orange accent line ───────────────────────────────────────────────────────
  orangeLine: {
    height: 4,
    backgroundColor: ORANGE,
  },

  // ── Quote title bar ──────────────────────────────────────────────────────────
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 6,
    backgroundColor: GRAY_LIGHT,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_MID,
  },
  quoteTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: BLACK,
    textAlign: 'right',
  },
  quoteMeta: {
    textAlign: 'left',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  quoteNumber: {
    fontWeight: 'bold',
    fontSize: 11,
    color: ORANGE,
    textAlign: 'left',
  },
  quoteDateText: {
    fontSize: 8,
    color: GRAY_TEXT,
    textAlign: 'left',
    marginTop: 2,
  },

  // ── Body ─────────────────────────────────────────────────────────────────────
  body: {
    paddingHorizontal: 28,
    paddingTop: 8,
  },

  // ── Client section ──────────────────────────────────────────────────────────
  sectionCard: {
    backgroundColor: GRAY_LIGHT,
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  sectionTitleDot: {
    width: 3,
    height: 11,
    backgroundColor: ORANGE,
    marginRight: 6,
    borderRadius: 1,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 9,
    color: BLACK,
    textAlign: 'right',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 3,
  },
  fieldLabel: {
    fontSize: 7.5,
    color: GRAY_TEXT,
    textAlign: 'right',
  },
  fieldValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: BLACK,
    textAlign: 'right',
  },

  // ── Table ────────────────────────────────────────────────────────────────────
  tableContainer: {
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F2',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 2,
    borderBottomColor: ORANGE,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  // Bottom border lives on the ITEM WRAPPER (not tableRow) so the separator line
  // appears after all item content (description + notes + images), not just the first row.
  itemWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#C0C0C0',
  },
  tableRowAlt: {
    backgroundColor: GRAY_LIGHT,
  },
  thText: {
    fontWeight: 'bold',
    fontSize: 8,
    color: BLACK,
    textAlign: 'right',
  },
  tdText: {
    fontSize: 8.5,
    color: BLACK,
    textAlign: 'right',
  },
  tdNum: {
    fontSize: 8.5,
    color: BLACK,
    textAlign: 'left',
  },
  notesRow: {
    paddingHorizontal: 6,
    paddingTop: 2,
    paddingBottom: 4,
    backgroundColor: '#FAFAFA',
  },
  notesText: {
    fontSize: 7.5,
    color: GRAY_TEXT,
    textAlign: 'right',
  },

  // RTL column order (visual right→left): מס׳ | תיאור עבודה | יח׳ | כמות | מחיר יח׳ | סה״כ
  // Fixed widths (not flex) so react-pdf wraps text within a hard boundary.
  // Total: 17+17+8+9+44+5 = 100%
  colTotal: { width: '17%' },
  colPrice: { width: '17%' },
  colQty:   { width: '8%' },
  colUnit:  { width: '9%' },                                          // +1% for clearer יח׳ column
  colDesc:  { width: '44%', paddingLeft: 10, paddingRight: 5 },       // left gap vs יח׳, right gap vs מס׳
  colNum:   { width: '5%' },                                          // -1% to balance

  tableRowOptional: {
    backgroundColor: '#FFFBEB',
  },
  optionalLabel: {
    fontSize: 6.5,
    color: '#D97706',
    fontWeight: 'bold' as never,
    textAlign: 'right' as never,
    marginBottom: 1,
  },
  optionalFootnote: {
    marginTop: 6,
    paddingHorizontal: 6,
  },
  optionalFootnoteText: {
    fontSize: 7.5,
    color: '#D97706',
    textAlign: 'right' as never,
  },

  // ── Images ───────────────────────────────────────────────────────────────────
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 6,
    paddingBottom: 6,
    backgroundColor: '#FAFAFA',
  },
  itemImage: {
    width: 64,
    height: 64,
    objectFit: 'cover',
    borderRadius: 2,
  },

  // ── Financial summary ────────────────────────────────────────────────────────
  summaryWrapper: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  summaryBox: {
    width: 220,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GRAY_MID,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_MID,
  },
  summaryLabel: {
    fontSize: 8.5,
    color: GRAY_TEXT,
    textAlign: 'right',
  },
  summaryValue: {
    fontSize: 8.5,
    color: BLACK,
    textAlign: 'left',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: ORANGE,
  },
  summaryTotalLabel: {
    fontWeight: 'bold',
    fontSize: 10,
    color: WHITE,
    textAlign: 'right',
  },
  summaryTotalValue: {
    fontWeight: 'bold',
    fontSize: 10,
    color: WHITE,
    textAlign: 'left',
  },

  // ── Terms ────────────────────────────────────────────────────────────────────
  termSection: {
    borderTopWidth: 1,
    borderTopColor: GRAY_MID,
    paddingTop: 6,
    marginBottom: 8,
  },
  termRow: {
    marginBottom: 4,
  },
  termLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: ORANGE,
    textAlign: 'right',
    marginBottom: 1,
  },
  termValue: {
    fontSize: 8.5,
    color: BLACK,
    textAlign: 'right',
  },

  // ── Signature ────────────────────────────────────────────────────────────────
  signatureSection: {
    borderTopWidth: 1,
    borderTopColor: GRAY_MID,
    paddingTop: 6,
    marginBottom: 6,
    alignItems: 'flex-end',
  },
  signatureImage: {
    height: 36,
    maxWidth: 120,
    objectFit: 'contain',
    marginBottom: 4,
  },
  signatureGreeting: {
    fontSize: 8.5,
    color: GRAY_TEXT,
    textAlign: 'right',
    marginBottom: 2,
  },
  signatureName: {
    fontSize: 9,
    fontWeight: 'bold',
    color: BLACK,
    textAlign: 'right',
  },
  signatureCompany: {
    fontSize: 8,
    color: GRAY_TEXT,
    textAlign: 'right',
    marginTop: 1,
  },

  // ── Draft watermark ──────────────────────────────────────────────────────────
  watermarkContainer: {
    position: 'absolute',
    top: '38%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkInner: {
    transform: 'rotate(-35deg)',
  },
  watermarkText: {
    fontFamily: 'Heebo',
    fontWeight: 'bold',
    fontSize: 100,
    color: '#9CA3AF',
    opacity: 0.25,
    letterSpacing: 8,
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerLine: {
    height: 3,
    backgroundColor: ORANGE,
  },
  footerRow: {
    alignItems: 'center',
    paddingTop: 5,
    paddingBottom: 2,
    paddingHorizontal: 28,
    backgroundColor: GRAY_LIGHT,
  },
  footerCompanyRow: {
    alignItems: 'center',
    paddingBottom: 5,
    paddingHorizontal: 28,
    backgroundColor: GRAY_LIGHT,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 7,
    color: GRAY_TEXT,
  },
  footerPageNum: {
    fontSize: 7.5,
    color: GRAY_TEXT,
    textAlign: 'center' as never,
    fontWeight: 'bold' as never,
  },

  // ── Compact continuation header (in-flow on page 2 continuation block) ───────
  continuationBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 5,
    marginHorizontal: -28,
    backgroundColor: WHITE,
  },
  continuationBandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  continuationBandRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: -18,
  },
  continuationOrangeLine: {
    height: 3,
    backgroundColor: ORANGE,
    marginHorizontal: -28,
  },
  logoSmall: {
    height: 22,
    width: 48,
    objectFit: 'contain',
  },
  continuationCompanyName: {
    fontWeight: 'bold',
    fontSize: 10,
    color: BLACK,
    textAlign: 'right',
  },
  continuationQuoteTitle: {
    fontWeight: 'bold',
    fontSize: 9,
    color: BLACK,
  },
  continuationQuoteNum: {
    fontSize: 8,
    fontWeight: 'bold' as never,
    color: ORANGE,
  },
  continuationLabel: {
    fontSize: 8,
    fontWeight: 'bold' as never,
    color: GRAY_TEXT,
    textAlign: 'right' as never,
    marginTop: 8,
    marginBottom: 4,
  },
})

// ── Inline bold renderer — parses **text** markers ────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderBoldText(rawText: string, style: any) {
  const text = fixRtlText(rawText)
  const segments = text.split(/(\*\*[^*\n]+\*\*)/g)
  if (segments.length === 1) {
    return <Text style={style}>{text}</Text>
  }
  return (
    <Text style={style}>
      {segments.map((seg, i) =>
        seg.startsWith('**') && seg.endsWith('**') ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Text key={i} style={{ fontWeight: 'bold' as any }}>{seg.slice(2, -2)}</Text>
        ) : (
          <Text key={i}>{seg}</Text>
        )
      )}
    </Text>
  )
}


// Strip Unicode directional control characters before PDF rendering.
// react-pdf/PDFKit renders them as visible glyphs instead of invisible
// formatting hints, producing garbled artifacts (i, g, Ê, etc.).
function stripBidiControlChars(text: string): string {
  return text.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderNoteLines(rawText: string, style: any): React.ReactElement[] {
  const paras = parseNotes(rawText).filter((p) => p.text.trim())
  if (paras.length === 0) return []
  return [
    <Text key="lbl" style={style}>{'הערה'}</Text>,
    ...paras.map((para, idx): React.ReactElement => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paraStyle: any = para.bold ? { ...style, fontWeight: 'bold' } : style
      // fixRtlText appends U+200F (RLM) after each line — same as exclusions/descriptions.
      // Without it, trailing neutral punctuation (e.g. ".") resolves to LTR paragraph
      // direction and appears at the wrong visual position.
      const text = fixRtlText(stripBidiControlChars(para.text).trim())
      return <Text key={idx} style={paraStyle}>{text}</Text>
    }),
  ]
}

// ── Section title helper ───────────────────────────────────────────────────────
function SectionTitle({ children }: { children: string }) {
  return (
    <View style={s.sectionTitleRow}>
      <Text style={s.sectionTitle}>{children}</Text>
      <View style={s.sectionTitleDot} />
    </View>
  )
}

// ── Page-split helpers ────────────────────────────────────────────────────────
// Height constants (pt). Measured from stylesheet values; used before render to
// bucket items into pages so react-pdf never auto-breaks mid-table.
const CHARS_PER_DESC_LINE = 40   // desc column effective ~222pt (44% of 539 − paddingLeft:10 − paddingRight:5)
const LINE_HEIGHT_PT       = 11  // fontSize 8.5 * ~1.3
const ITEM_BASE_HEIGHT_PT  = 22  // tableRow paddingVertical:6 + 1 desc line + itemWrapper border
const OPTIONAL_LABEL_EXTRA = 10  // optionalLabel fontSize 6.5 + marginBottom
const NOTES_BASE_HEIGHT_PT = 14  // notesRow paddingTop:2 + paddingBottom:4 + 1 line at fontSize 7.5
const NOTES_LINE_HEIGHT_PT = 10  // fontSize 7.5 * 1.3
const NOTES_CHARS_PER_LINE = 45
const IMAGE_ROW_HEIGHT_PT  = 70  // 64pt image + 6pt paddingBottom per row
const IMAGES_PER_ROW       = 7   // floor((539pt usable − 12pt padding) / (64+4)pt per image)

function estimateItemHeight(item: PdfItem): number {
  const descLines = Math.max(1, Math.ceil(item.description.length / CHARS_PER_DESC_LINE))
  let h = ITEM_BASE_HEIGHT_PT + (descLines - 1) * LINE_HEIGHT_PT
  if (item.is_optional) h += OPTIONAL_LABEL_EXTRA
  if (item.notes) {
    const notesParas = parseNotes(item.notes).filter((p) => p.text.trim())
    if (notesParas.length > 0) {
      // +1 for the label line, then sum wrapped lines per paragraph
      const wrappedLines = notesParas.reduce((acc, p) => {
        const sublines = p.text.split('\n')
        return acc + sublines.reduce((s, l) => s + Math.max(1, Math.ceil(l.length / NOTES_CHARS_PER_LINE)), 0)
      }, 0)
      h += NOTES_BASE_HEIGHT_PT + wrappedLines * NOTES_LINE_HEIGHT_PT
    }
  }
  const pdfImages = item.images.filter((img) => img.include_in_pdf && img.signedUrl)
  if (pdfImages.length > 0) {
    const imageRows = Math.ceil(pdfImages.length / IMAGES_PER_ROW)
    h += imageRows * IMAGE_ROW_HEIGHT_PT + (imageRows - 1) * 4  // rows + inter-row gaps
  }
  return h
}

// Estimates the rendered height of the summary block (financial totals, payment
// terms, optional footnote, exclusions, signature). Used to reserve space on the
// last items page so the block never gets pushed alone to a new page.
function estimateSummaryBlockHeight({
  hasPaymentTerms,
  hasOptionItems,
  exclusionsText,
  hasSignature,
}: {
  hasPaymentTerms: boolean
  hasOptionItems: boolean
  exclusionsText: string
  hasSignature: boolean
}): number {
  // Financial summary box (3 rows ~66pt) + marginBottom:6 + some border/spacing
  let h = 80
  // Payment terms is side-by-side with summary box; may add height if text is long
  if (hasPaymentTerms) h += 15
  // Optional footnote: marginTop:6 + 1 line text
  if (hasOptionItems) h += 22
  // Exclusions: overhead (borderTop + padding + margins + label ~36pt) + content lines
  if (exclusionsText) {
    const lines = Math.max(1, Math.ceil(exclusionsText.length / 55))
    h += 36 + lines * 12
  }
  // Signature block: greeting + name + company + image
  if (hasSignature) h += 96
  // Safety buffer for rounding and rendering variance
  h += 40
  return h
}

function splitItemsForPages(
  items: PdfItem[],
  firstBudget: number,
  contBudget: number,
): PdfItem[][] {
  if (items.length === 0) return [[]]
  const pages: PdfItem[][] = []
  let currentPage: PdfItem[] = []
  let currentHeight = 0
  let budget = firstBudget
  for (const item of items) {
    const h = estimateItemHeight(item)
    if (currentPage.length > 0 && currentHeight + h > budget) {
      pages.push(currentPage)
      currentPage = [item]
      currentHeight = h
      budget = contBudget
    } else {
      currentPage.push(item)
      currentHeight += h
    }
  }
  if (currentPage.length > 0) pages.push(currentPage)
  return pages
}

// ── PDF Document ───────────────────────────────────────────────────────────────
export function QuotePDF({ quote, items, company, logoUrl, creator }: QuotePDFProps) {
  const requiredItems = items.filter((i) => !i.is_optional)
  const hasOptional = items.some((i) => i.is_optional)
  const subtotal = requiredItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  const adjResult = applyPriceAdjustments(subtotal, parsePriceAdjustments(quote.price_adjustments))
  const adjustedSubtotal = adjResult.adjustedTotal
  const vatAmount = (adjustedSubtotal * quote.vat_percentage) / 100
  const total = adjustedSubtotal + vatAmount

  // Local logo fallback
  const localLogo = path.join(process.cwd(), 'public', 'company-logo.png')
  const effectiveLogo = logoUrl ?? localLogo

  const summaryReserve = estimateSummaryBlockHeight({
    hasPaymentTerms: !!quote.payment_terms,
    hasOptionItems: hasOptional,
    exclusionsText: quote.exclusions ?? '',
    hasSignature: !!(creator && quote.status !== 'draft'),
  })

  // Budgets are purely for table item rows — summaryReserve is NOT deducted here.
  // Previously, subtracting it from every page's budget caused page 1 to be badly
  // under-filled: the summary only appears on the last page, so reserving its space
  // on every page (including page 1 when there are continuation pages) is wrong.
  // A4 = 841pt; paddingBottom:40 → usable = 801pt.
  // Page 1 overhead: topBand(~70) + orangeLine(4) + titleBar(~38) + body.paddingTop(8) + clientCard(~85) + tableHeader(~20) ≈ 245pt.
  // Cont overhead:   continuationBand(~32) + orangeLine(3) + contLabel(~23) + tableHeader(~20) ≈ 83pt (unchanged).
  const PAGE_USABLE             = 801
  const FIRST_PAGE_ITEMS_BUDGET = Math.max(150, PAGE_USABLE - 245)  // ≈ 556pt
  const CONT_PAGE_ITEMS_BUDGET  = Math.max(300, PAGE_USABLE - 83)   // ≈ 718pt

  let itemPages = splitItemsForPages(items, FIRST_PAGE_ITEMS_BUDGET, CONT_PAGE_ITEMS_BUDGET)

  // Ensure the last page has room for the summary block.
  // If items on the last page + summaryReserve exceed that page's budget, spill
  // the last item onto a new continuation page so the summary never overflows.
  {
    const lastIdx    = itemPages.length - 1
    const lastBudget = lastIdx === 0 ? FIRST_PAGE_ITEMS_BUDGET : CONT_PAGE_ITEMS_BUDGET
    const lastH      = itemPages[lastIdx].reduce((acc, it) => acc + estimateItemHeight(it), 0)
    if (lastH + summaryReserve > lastBudget && itemPages[lastIdx].length > 1) {
      const moved = itemPages[lastIdx].pop()!
      itemPages.push([moved])
    }
  }

  // Post-processing: if page 1 is under-utilised (<70% full) and page 2 has multiple
  // items, pull items from page 2 to page 1 as long as they fit.
  // Guard — skip when page 2 has only 1 item: that item was placed there by the
  // summary spill above, and pulling it back would trigger the spill again (conflict).
  if (itemPages.length > 1 && itemPages[1].length > 1) {
    let page1H = itemPages[0].reduce((acc, it) => acc + estimateItemHeight(it), 0)
    while (itemPages[1].length > 1 && page1H / FIRST_PAGE_ITEMS_BUDGET < 0.70) {
      const candidate  = itemPages[1][0]
      const candidateH = estimateItemHeight(candidate)
      if (page1H + candidateH > FIRST_PAGE_ITEMS_BUDGET) break
      itemPages[0].push(itemPages[1].shift()!)
      page1H += candidateH
    }
  }

  const itemPageOffsets = itemPages.map((_, i) =>
    itemPages.slice(0, i).reduce((acc, p) => acc + p.length, 0)
  )

  // Shared table header JSX — used in both the main table and the page-2 continuation
  const tableHeaderRow = (
    <View style={s.tableHeader}>
      <View style={s.colTotal}><Text style={[s.thText, { textAlign: 'left' }]}>סה״כ</Text></View>
      <View style={s.colPrice}><Text style={[s.thText, { textAlign: 'left' }]}>מחיר יח׳</Text></View>
      <View style={s.colQty}><Text style={[s.thText, { textAlign: 'left' }]}>כמות</Text></View>
      <View style={s.colUnit}><Text style={s.thText}>יח׳</Text></View>
      <View style={s.colDesc}><Text style={s.thText}>תיאור עבודה</Text></View>
      <View style={[s.colNum, { alignItems: 'center' }]}><Text style={s.thText}>מס׳</Text></View>
    </View>
  )

  // Item row renderer — display-only; does not affect any financial calculations
  const renderItemRow = (item: PdfItem, idx: number) => {
    const lineTotal = item.quantity * item.unit_price
    const isAlt = idx % 2 === 1
    const isOptional = item.is_optional ?? false
    const hasPdfImages = item.images.filter((img) => img.include_in_pdf && img.signedUrl).length > 0
    return (
      <View key={item.item_number} wrap={false} style={s.itemWrapper}>
        <View style={[s.tableRow, isAlt ? s.tableRowAlt : {}, isOptional ? s.tableRowOptional : {}]}>
          <View style={s.colTotal}><Text style={s.tdNum}>{fmtCurrency(lineTotal)}</Text></View>
          <View style={s.colPrice}><Text style={s.tdNum}>{fmtCurrency(item.unit_price)}</Text></View>
          <View style={s.colQty}><Text style={s.tdNum}>{item.quantity}</Text></View>
          <View style={s.colUnit}><Text style={s.tdText}>{item.unit}</Text></View>
          <View style={s.colDesc}>
            {isOptional && <Text style={s.optionalLabel}>אופציה *‏</Text>}
            {renderBoldText(item.description, s.tdText)}
          </View>
          <View style={[s.colNum, { alignItems: 'center' }]}><Text style={s.tdText}>{item.item_number}</Text></View>
        </View>
        {item.notes ? (
          <View style={s.notesRow}>
            {renderNoteLines(item.notes, s.notesText)}
          </View>
        ) : null}
        {hasPdfImages && (
          <View style={s.imageGrid}>
            {item.images
              .filter((img) => img.include_in_pdf && img.signedUrl)
              .map((img, i) => (
                <Image key={i} src={img.signedUrl} style={s.itemImage} />
              ))}
          </View>
        )}
      </View>
    )
  }

  // Summary + payment terms side-by-side + exclusions + signature.
  // Shared between single-page and continuation-page paths.
  const renderSummaryBlock = () => (
    <View wrap={false}>
      {/* Summary box (LEFT) and payment terms (RIGHT) at the same height */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 6, alignItems: 'flex-start' }}>
        <View style={s.summaryBox}>
          <View style={s.summaryRow}>
            <Text style={s.summaryValue}>{fmtCurrency(subtotal)}</Text>
            <Text style={s.summaryLabel}>
              {adjResult.adjustments.length > 0 ? 'סה״כ לפני הנחות/תוספות' : 'סה״כ לפני מע״מ'}
            </Text>
          </View>
          {adjResult.adjustments.map((adj) => (
            <View key={adj.id} style={s.summaryRow}>
              <Text style={[s.summaryValue, { color: adj.type === 'addition' ? '#16a34a' : '#dc2626' }]}>
                {adj.type === 'addition' ? '+' : '-'}{fmtCurrency(adj.amount)}
              </Text>
              <Text style={s.summaryLabel}>{adj.name} {adj.percentage}%</Text>
            </View>
          ))}
          {adjResult.adjustments.length > 0 && (
            <View style={s.summaryRow}>
              <Text style={s.summaryValue}>{fmtCurrency(adjustedSubtotal)}</Text>
              <Text style={s.summaryLabel}>סה״כ לאחר הנחות/תוספות</Text>
            </View>
          )}
          <View style={s.summaryRow}>
            <Text style={s.summaryValue}>{fmtCurrency(vatAmount)}</Text>
            <Text style={s.summaryLabel}>מע״מ {quote.vat_percentage}%</Text>
          </View>
          <View style={s.summaryTotalRow}>
            <Text style={s.summaryTotalValue}>{fmtCurrency(total)}</Text>
            <Text style={s.summaryTotalLabel}>
              {quote.vat_percentage > 0 ? 'סה״כ כולל מע״מ' : 'סה״כ'}
            </Text>
          </View>
        </View>
        {quote.payment_terms ? (
          <View style={{ flex: 1, paddingTop: 2 }}>
            <Text style={s.termLabel}>תנאי תשלום</Text>
            <Text style={s.termValue}>{fixRtlText(quote.payment_terms)}</Text>
          </View>
        ) : null}
      </View>
      {hasOptional && (
        <View style={s.optionalFootnote}>
          <Text style={s.optionalFootnoteText}>
            {'* סעיפי אופציה אינם כלולים בסה״כ ההצעה ויבוצעו רק באישור המזמין‏'}
          </Text>
        </View>
      )}
      {quote.exclusions ? (
        <View style={{ borderTopWidth: 1, borderTopColor: GRAY_MID, paddingTop: 5, marginTop: 4, marginBottom: 6 }}>
          <Text style={s.termLabel}>החרגות / הערות</Text>
          <Text style={s.termValue}>{fixRtlText(quote.exclusions)}</Text>
        </View>
      ) : null}
      {creator && quote.status !== 'draft' ? (
        <View style={s.signatureSection}>
          <Text style={s.signatureGreeting}>{'בברכה,‏'}</Text>
          <Text style={s.signatureName}>
            {creator.full_name}
            {creator.job_title ? ` - ${creator.job_title}` : ''}
          </Text>
          <Text style={s.signatureCompany}>{company.company_name}</Text>
          {creator.signature_url ? (
            <Image src={creator.signature_url} style={s.signatureImage} />
          ) : null}
        </View>
      ) : null}
    </View>
  )

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Top header band ─────────────────────────────────────────── */}
        <View style={s.topBand}>
          <View style={s.topBandLeft}>
            <Text style={s.companyName}>{company.company_name}</Text>
            {company.company_id_number ? (
              <Text style={s.companyDetail}>ח.פ: {company.company_id_number}</Text>
            ) : null}
            {company.address ? (
              <Text style={s.companyDetail}>{company.address}</Text>
            ) : null}
            {company.phone ? (
              <Text style={s.companyDetail}>{company.phone}</Text>
            ) : null}
            {company.email ? (
              <Text style={s.companyDetail}>{company.email}</Text>
            ) : null}
          </View>
          <View style={{ alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginRight: -18 }}>
            <Image src={effectiveLogo} style={s.logo} />
          </View>
        </View>

        {/* ── Orange accent line ──────────────────────────────────────── */}
        <View style={s.orangeLine} />

        {/* ── Quote title bar ─────────────────────────────────────────── */}
        <View style={s.titleBar}>
          <View style={s.quoteMeta}>
            <Text style={s.quoteNumber}>{quote.quote_number ?? '—'}</Text>
            {quote.valid_until ? (
              <Text style={s.quoteDateText}>בתוקף עד {fmtDate(quote.valid_until)}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.quoteTitle}>הצעת מחיר</Text>
            <Text style={[s.quoteDateText, { marginTop: 2 }]}>
              תאריך ההצעה: {fmtDate(quote.quote_date)}
            </Text>
          </View>
        </View>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <View style={s.body}>

          {/* ── Client info — 2-column layout to reduce vertical height ── */}
          <View style={s.sectionCard}>
            <SectionTitle>פרטי לקוח</SectionTitle>
            <View style={{ flexDirection: 'row', gap: 12 }}>

              {/* LEFT column (visual left = secondary info): כתובת + תיאור פרויקט */}
              <View style={{ flex: 1, gap: 4 }}>
                {quote.client_address ? (
                  <View>
                    <Text style={s.fieldLabel}>כתובת העבודה</Text>
                    <Text style={s.fieldValue}>{quote.client_address}</Text>
                  </View>
                ) : null}
                {quote.project_description ? (
                  <View>
                    <Text style={s.fieldLabel}>תיאור הפרויקט</Text>
                    <Text style={[s.fieldValue, { fontWeight: 'normal' as never }]}>
                      {fixRtlText(quote.project_description)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* RIGHT column (visual right = primary info): לכבוד + איש קשר */}
              <View style={{ flex: 1, gap: 4 }}>
                <View>
                  <Text style={s.fieldLabel}>לכבוד</Text>
                  <Text style={[s.fieldValue, { fontSize: 10 }]}>{quote.client_name || '—'}</Text>
                </View>
                {quote.client_contact ? (
                  <View>
                    <Text style={s.fieldLabel}>איש קשר</Text>
                    <Text style={s.fieldValue}>{quote.client_contact}</Text>
                  </View>
                ) : null}
              </View>

            </View>
          </View>

          {/* ── Items table (page 1) ───────────────────────────────── */}
          <View style={s.tableContainer}>
            {tableHeaderRow}
            {itemPages[0].map((item, idx) => renderItemRow(item, itemPageOffsets[0] + idx))}
          </View>

          {/* ── Continuation pages + summary ────────────────────────── */}
          {itemPages.length === 1
            ? renderSummaryBlock()
            : itemPages.slice(1).map((pageItems, pi) => (
                <View key={pi} break>
                  <View style={s.continuationBand}>
                    <View style={s.continuationBandLeft}>
                      <Text style={s.continuationQuoteTitle}>הצעת מחיר</Text>
                      <Text style={s.continuationQuoteNum}>{quote.quote_number ?? '—'}</Text>
                    </View>
                    <View style={s.continuationBandRight}>
                      <Text style={s.continuationCompanyName}>{company.company_name}</Text>
                      <Image src={effectiveLogo} style={s.logoSmall} />
                    </View>
                  </View>
                  <View style={s.continuationOrangeLine} />
                  <Text style={s.continuationLabel}>{'המשך טבלת סעיפים‏'}</Text>
                  <View style={s.tableContainer}>
                    {tableHeaderRow}
                    {pageItems.map((item, idx) => renderItemRow(item, itemPageOffsets[pi + 1] + idx))}
                  </View>
                  {pi === itemPages.length - 2 && renderSummaryBlock()}
                </View>
              ))
          }

        </View>

        {/* ── Draft watermark (over body, under footer) ───────────────── */}
        {quote.status === 'draft' && (
          <View style={s.watermarkContainer} fixed>
            <View style={s.watermarkInner}>
              <Text style={s.watermarkText}>טיוטה</Text>
            </View>
          </View>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <View style={s.footerLine} />
          <View style={s.footerRow}>
            <Text
              style={s.footerPageNum}
              render={({ pageNumber, totalPages }) =>
                `עמוד ${pageNumber} מתוך ${totalPages}`
              }
            />
          </View>
          {company.footer_text ? (
            <View style={s.footerCompanyRow}>
              <Text style={s.footerText}>{company.footer_text}</Text>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  )
}
