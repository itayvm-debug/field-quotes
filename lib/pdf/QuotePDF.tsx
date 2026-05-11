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
    paddingBottom: 50,
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
    paddingTop: 16,
    paddingBottom: 12,
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
    height: 42,
    width: 90,
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
    paddingVertical: 10,
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
    paddingTop: 14,
  },

  // ── Client section ──────────────────────────────────────────────────────────
  sectionCard: {
    backgroundColor: GRAY_LIGHT,
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 7,
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
    marginLeft: 4,
  },
  fieldValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: BLACK,
    textAlign: 'right',
  },

  // ── Table ────────────────────────────────────────────────────────────────────
  tableContainer: {
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F2',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 2,
    borderBottomColor: ORANGE,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
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
    paddingBottom: 4,
    backgroundColor: '#FAFAFA',
  },
  notesText: {
    fontSize: 7.5,
    color: GRAY_TEXT,
    textAlign: 'right',
  },

  // RTL column order: total | price | qty | unit | description | #
  colTotal: { flex: 1.3 },
  colPrice: { flex: 1.3 },
  colQty:   { flex: 0.65 },
  colUnit:  { flex: 0.75 },
  colDesc:  { flex: 3.5 },
  colNum:   { flex: 0.3, textAlign: 'center' as never },

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
    marginBottom: 12,
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
    paddingVertical: 5,
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
    paddingVertical: 7,
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
    paddingTop: 8,
    marginBottom: 10,
  },
  termRow: {
    marginBottom: 5,
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
    paddingTop: 10,
    marginBottom: 10,
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
  footerText: {
    textAlign: 'center',
    fontSize: 7,
    color: GRAY_TEXT,
    paddingVertical: 6,
    paddingHorizontal: 28,
    backgroundColor: GRAY_LIGHT,
  },
})

// ── Section title helper ───────────────────────────────────────────────────────
function SectionTitle({ children }: { children: string }) {
  return (
    <View style={s.sectionTitleRow}>
      <Text style={s.sectionTitle}>{children}</Text>
      <View style={s.sectionTitleDot} />
    </View>
  )
}

// ── PDF Document ───────────────────────────────────────────────────────────────
export function QuotePDF({ quote, items, company, logoUrl, creator }: QuotePDFProps) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  const vatAmount = (subtotal * quote.vat_percentage) / 100
  const total = subtotal + vatAmount

  // Local logo fallback
  const localLogo = path.join(process.cwd(), 'public', 'company-logo.png')
  const effectiveLogo = logoUrl ?? localLogo

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
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
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

          {/* ── Client info ─────────────────────────────────────────── */}
          <View style={s.sectionCard}>
            <SectionTitle>פרטי לקוח</SectionTitle>
            <View style={{ gap: 5 }}>
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
                    {quote.project_description}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── Items table ─────────────────────────────────────────── */}
          <View style={s.tableContainer}>
            {/* Header — RTL: סה"כ | מחיר יח' | כמות | יח' | תיאור | # */}
            <View style={s.tableHeader}>
              <Text style={[s.thText, s.colTotal, { textAlign: 'left' }]}>סה״כ</Text>
              <Text style={[s.thText, s.colPrice, { textAlign: 'left' }]}>מחיר יח׳</Text>
              <Text style={[s.thText, s.colQty, { textAlign: 'left' }]}>כמות</Text>
              <Text style={[s.thText, s.colUnit]}>יח׳</Text>
              <Text style={[s.thText, s.colDesc]}>תיאור עבודה</Text>
              <Text style={[s.thText, s.colNum]}>מס׳</Text>
            </View>

            {items.map((item, idx) => {
              const lineTotal = item.quantity * item.unit_price
              const isAlt = idx % 2 === 1
              const hasPdfImages = item.images.filter((img) => img.include_in_pdf && img.signedUrl).length > 0
              return (
                <View key={item.item_number} wrap={false}>
                  <View style={[s.tableRow, isAlt ? s.tableRowAlt : {}]}>
                    <Text style={[s.tdNum, s.colTotal]}>{fmtCurrency(lineTotal)}</Text>
                    <Text style={[s.tdNum, s.colPrice]}>{fmtCurrency(item.unit_price)}</Text>
                    <Text style={[s.tdNum, s.colQty]}>{item.quantity}</Text>
                    <Text style={[s.tdText, s.colUnit]}>{item.unit}</Text>
                    <Text style={[s.tdText, s.colDesc]}>{item.description}</Text>
                    <Text style={[s.tdText, s.colNum, { textAlign: 'center' }]}>
                      {item.item_number}
                    </Text>
                  </View>
                  {item.notes ? (
                    <View style={s.notesRow}>
                      <Text style={s.notesText}>הערה: {item.notes}</Text>
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
            })}
          </View>

          {/* ── Financial summary ────────────────────────────────────── */}
          <View style={s.summaryWrapper}>
            <View style={s.summaryBox}>
              <View style={s.summaryRow}>
                <Text style={s.summaryValue}>{fmtCurrency(subtotal)}</Text>
                <Text style={s.summaryLabel}>סה״כ לפני מע״מ</Text>
              </View>
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
          </View>

          {/* ── Terms ───────────────────────────────────────────────── */}
          {(quote.payment_terms || quote.exclusions) && (
            <View style={s.termSection}>
              {quote.payment_terms ? (
                <View style={s.termRow}>
                  <Text style={s.termLabel}>תנאי תשלום</Text>
                  <Text style={s.termValue}>{fixRtlText(quote.payment_terms)}</Text>
                </View>
              ) : null}
              {quote.exclusions ? (
                <View style={s.termRow}>
                  <Text style={s.termLabel}>החרגות / הערות</Text>
                  <Text style={s.termValue}>{fixRtlText(quote.exclusions)}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* ── Signature ───────────────────────────────────────────── */}
          {creator && quote.status !== 'draft' && (
            <View style={s.signatureSection}>
              {creator.signature_url ? (
                <Image src={creator.signature_url} style={s.signatureImage} />
              ) : null}
              <Text style={s.signatureGreeting}>{'בברכה,‏'}</Text>
              <Text style={s.signatureName}>
                {creator.full_name}
                {creator.job_title ? ` - ${creator.job_title}` : ''}
              </Text>
              <Text style={s.signatureCompany}>{company.company_name}</Text>
            </View>
          )}

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
          {company.footer_text ? (
            <Text style={s.footerText}>{company.footer_text}</Text>
          ) : null}
        </View>
      </Page>
    </Document>
  )
}
