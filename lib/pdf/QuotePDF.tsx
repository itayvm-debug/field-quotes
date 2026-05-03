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

Font.register({
  family: 'Heebo',
  fonts: [
    {
      src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/static/Heebo-Regular.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/static/Heebo-Bold.ttf',
      fontWeight: 'bold',
    },
  ],
})

const fmtCurrency = (n: number) =>
  '₪' + n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (s: string | null | undefined) => {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleDateString('he-IL')
}

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

export interface QuotePDFProps {
  quote: PdfQuote
  items: PdfItem[]
  company: PdfCompany
  logoUrl: string | null
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Heebo',
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    color: '#1f2937',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  logo: {
    width: 70,
    height: 40,
    objectFit: 'contain',
  },
  companyBlock: {
    textAlign: 'right',
    flex: 1,
    paddingRight: 8,
  },
  companyName: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
    textAlign: 'right',
  },
  companyDetail: {
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'right',
    marginBottom: 1,
  },
  quoteInfoBlock: {
    textAlign: 'left',
    minWidth: 100,
  },
  quoteNumber: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 2,
  },
  quoteDetail: {
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'left',
    marginBottom: 1,
  },

  // Section
  section: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'right',
    color: '#374151',
  },
  row2col: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 8,
    color: '#9ca3af',
    textAlign: 'right',
    marginBottom: 1,
  },
  fieldValue: {
    fontSize: 9,
    textAlign: 'right',
  },

  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e40af',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  thText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'right',
  },
  tdText: {
    fontSize: 8,
    textAlign: 'right',
  },
  tdNumber: {
    fontSize: 8,
    textAlign: 'left',
    direction: 'ltr' as never,
  },

  // Column widths (RTL order: total, price, qty, unit, description, #)
  colTotal: { flex: 1.2, textAlign: 'left' as never },
  colPrice: { flex: 1.2, textAlign: 'left' as never },
  colQty: { flex: 0.7, textAlign: 'left' as never },
  colUnit: { flex: 0.7, textAlign: 'right' as never },
  colDesc: { flex: 3.5, textAlign: 'right' as never },
  colNum: { flex: 0.4, textAlign: 'right' as never },

  // Images
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  itemImage: {
    width: 60,
    height: 60,
    objectFit: 'cover',
    borderRadius: 2,
  },

  // Summary
  summaryBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 3,
    gap: 8,
  },
  summaryLabel: {
    fontSize: 9,
    textAlign: 'right',
    color: '#6b7280',
    minWidth: 100,
  },
  summaryValue: {
    fontSize: 9,
    textAlign: 'left',
    minWidth: 80,
    direction: 'ltr' as never,
  },
  summaryTotalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'right',
    minWidth: 100,
  },
  summaryTotalValue: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'left',
    color: '#1d4ed8',
    minWidth: 80,
    direction: 'ltr' as never,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 7,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
  },

  notesText: {
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 2,
  },
  termBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
})

// ── Component ─────────────────────────────────────────────────────────────────

export function QuotePDF({ quote, items, company, logoUrl }: QuotePDFProps) {
  const subtotal = items.reduce(
    (sum, i) => sum + i.quantity * i.unit_price,
    0
  )
  const vatAmount = (subtotal * quote.vat_percentage) / 100
  const total = subtotal + vatAmount

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.headerRow}>
          {/* Quote meta (left side, LTR numbers) */}
          <View style={s.quoteInfoBlock}>
            <Text style={s.quoteNumber}>{quote.quote_number ?? '—'}</Text>
            <Text style={s.quoteDetail}>תאריך: {fmtDate(quote.quote_date)}</Text>
            {quote.valid_until && (
              <Text style={s.quoteDetail}>תוקף: {fmtDate(quote.valid_until)}</Text>
            )}
          </View>

          {/* Company info (right side) */}
          <View style={s.companyBlock}>
            <Text style={s.companyName}>{company.company_name}</Text>
            {company.company_id_number && (
              <Text style={s.companyDetail}>ח.פ: {company.company_id_number}</Text>
            )}
            {company.address && (
              <Text style={s.companyDetail}>{company.address}</Text>
            )}
            {company.phone && (
              <Text style={s.companyDetail}>{company.phone}</Text>
            )}
            {company.email && (
              <Text style={s.companyDetail}>{company.email}</Text>
            )}
          </View>

          {/* Logo (far right) */}
          {logoUrl && (
            <Image src={logoUrl} style={s.logo} />
          )}
        </View>

        {/* ── Client info ────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>פרטי לקוח</Text>
          <View style={s.row2col}>
            <View style={{ flex: 1 }}>
              {quote.client_address && (
                <>
                  <Text style={s.fieldLabel}>כתובת</Text>
                  <Text style={s.fieldValue}>{quote.client_address}</Text>
                </>
              )}
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={s.fieldLabel}>שם לקוח</Text>
              <Text style={[s.fieldValue, { fontWeight: 'bold' }]}>
                {quote.client_name || '—'}
              </Text>
              {quote.client_contact && (
                <>
                  <Text style={[s.fieldLabel, { marginTop: 4 }]}>איש קשר</Text>
                  <Text style={s.fieldValue}>{quote.client_contact}</Text>
                </>
              )}
            </View>
          </View>
          {quote.project_description && (
            <View style={{ marginTop: 6 }}>
              <Text style={s.fieldLabel}>תיאור הפרויקט</Text>
              <Text style={s.fieldValue}>{quote.project_description}</Text>
            </View>
          )}
        </View>

        {/* ── Items table ────────────────────────────────────────────── */}
        <View>
          {/* Table header — RTL column order: סה"כ | מחיר | כמות | יח' | תיאור | # */}
          <View style={s.tableHeader}>
            <Text style={[s.thText, s.colTotal]}>סה״כ</Text>
            <Text style={[s.thText, s.colPrice]}>מחיר יח׳</Text>
            <Text style={[s.thText, s.colQty]}>כמות</Text>
            <Text style={[s.thText, s.colUnit]}>יח׳</Text>
            <Text style={[s.thText, s.colDesc]}>תיאור</Text>
            <Text style={[s.thText, s.colNum]}>#</Text>
          </View>

          {items.map((item, idx) => {
            const lineTotal = item.quantity * item.unit_price
            const isAlt = idx % 2 === 1
            return (
              <View key={item.item_number} wrap={false}>
                <View style={[s.tableRow, isAlt ? s.tableRowAlt : {}]}>
                  <Text style={[s.tdNumber, s.colTotal]}>{fmtCurrency(lineTotal)}</Text>
                  <Text style={[s.tdNumber, s.colPrice]}>{fmtCurrency(item.unit_price)}</Text>
                  <Text style={[s.tdNumber, s.colQty]}>{item.quantity}</Text>
                  <Text style={[s.tdText, s.colUnit]}>{item.unit}</Text>
                  <Text style={[s.tdText, s.colDesc]}>{item.description}</Text>
                  <Text style={[s.tdText, s.colNum]}>{item.item_number}</Text>
                </View>
                {item.notes ? (
                  <Text style={[s.notesText, { paddingHorizontal: 4 }]}>
                    הערה: {item.notes}
                  </Text>
                ) : null}
                {/* Item images */}
                {item.images.filter((img) => img.include_in_pdf).length > 0 && (
                  <View style={[s.imageGrid, { paddingHorizontal: 4, paddingBottom: 4 }]}>
                    {item.images
                      .filter((img) => img.include_in_pdf)
                      .map((img, i) => (
                        <Image key={i} src={img.signedUrl} style={s.itemImage} />
                      ))}
                  </View>
                )}
              </View>
            )
          })}
        </View>

        {/* ── Financial summary ──────────────────────────────────────── */}
        <View style={s.summaryBlock}>
          <View style={s.summaryRow}>
            <Text style={s.summaryValue}>{fmtCurrency(subtotal)}</Text>
            <Text style={s.summaryLabel}>סה״כ לפני מע״מ</Text>
          </View>
          {quote.vat_percentage > 0 ? (
            <View style={s.summaryRow}>
              <Text style={s.summaryValue}>{fmtCurrency(vatAmount)}</Text>
              <Text style={s.summaryLabel}>מע״מ {quote.vat_percentage}%</Text>
            </View>
          ) : (
            <View style={s.summaryRow}>
              <Text style={[s.summaryValue, { color: '#9ca3af' }]}>לא חל</Text>
              <Text style={s.summaryLabel}>מע״מ</Text>
            </View>
          )}
          <View style={[s.summaryRow, { marginTop: 4 }]}>
            <Text style={s.summaryTotalValue}>{fmtCurrency(total)}</Text>
            <Text style={s.summaryTotalLabel}>
              {quote.vat_percentage > 0 ? 'סה״כ כולל מע״מ' : 'סה״כ לתשלום'}
            </Text>
          </View>
        </View>

        {/* ── Terms ──────────────────────────────────────────────────── */}
        {(quote.payment_terms || quote.exclusions) && (
          <View style={s.termBlock}>
            {quote.payment_terms && (
              <View style={{ marginBottom: 4 }}>
                <Text style={[s.fieldLabel, { fontSize: 8, fontWeight: 'bold' }]}>
                  תנאי תשלום
                </Text>
                <Text style={s.fieldValue}>{quote.payment_terms}</Text>
              </View>
            )}
            {quote.exclusions && (
              <View>
                <Text style={[s.fieldLabel, { fontSize: 8, fontWeight: 'bold' }]}>
                  החרגות / הערות
                </Text>
                <Text style={s.fieldValue}>{quote.exclusions}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        {company.footer_text && (
          <Text style={s.footer}>{company.footer_text}</Text>
        )}
      </Page>
    </Document>
  )
}
