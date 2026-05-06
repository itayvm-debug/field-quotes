import path from 'path'
import React from 'react'
import {
  Document, Page, View, Text, Image, Font, StyleSheet,
} from '@react-pdf/renderer'
import type { AnalyticsKPI, UserStats } from '@/lib/analytics/compute'

export interface RejectedRow {
  quoteNumber: string | null
  clientName: string
  quoteDate: string
  amount: number
  statusNote: string
  userName: string
}

export interface OverpayRow {
  quoteNumber: string | null
  clientName: string
  quoteDate: string
  total: number
  paid: number
  overpaymentNote: string
  userName: string
}

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'Heebo',
  fonts: [
    { src: path.join(FONTS_DIR, 'Heebo-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(FONTS_DIR, 'Heebo-Bold.ttf'), fontWeight: 'bold' },
  ],
})

const ORANGE = '#E86510'
const BLACK = '#1A1A1A'
const WHITE = '#FFFFFF'
const GRAY_BG = '#F6F6F6'
const GRAY_LINE = '#DEDEDE'
const GRAY_TEXT = '#666666'

// Portrait A4 usable width ≈ 539 pt (595 – 2×28 padding)
// Table 1 — status counts
const C1 = { name: 115, role: 58, total: 38, draft: 42, sent: 42, accepted: 42, rejected: 42, archived: 42 }
// Table 2 — financial (total: 115+68*5+40 = 495)
const C2 = { name: 115, totalAmt: 68, acceptedAmt: 68, paid: 68, open: 68, closed: 68, pct: 40 }
// Table 3 — rejected quotes (name:110 + date:50 + amount:70 + reason:220 + user:89 = 539)
const C3 = { name: 110, date: 50, amount: 70, reason: 220, user: 89 }
// Table 4 — overpay (name:110 + date:50 + total:60 + paid:60 + note:170 + user:89 = 539)
const C4 = { name: 110, date: 50, total: 60, paid: 60, note: 170, user: 89 }

const fmtCurrency = (n: number) => {
  const str = Math.abs(n).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `₪${str}`
}

const fmtDate = (s: string) => {
  const [y, m, d] = s.split('-')
  return `${d}.${m}.${y}`
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Heebo', fontSize: 8, color: BLACK, backgroundColor: WHITE,
    paddingHorizontal: 28, paddingTop: 22, paddingBottom: 36,
  },

  // ── Page header ────────────────────────────────────────────────────────────
  // row-reverse: first child (brand block) appears on RIGHT; last child (date) on LEFT
  pageHeader: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1.5, borderBottomColor: ORANGE, paddingBottom: 10, marginBottom: 10,
  },
  headerBrand: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  logo: { height: 28, objectFit: 'contain' },
  headerTitles: { alignItems: 'flex-end' },
  headerTitle: { fontSize: 13, fontWeight: 'bold', color: BLACK },
  headerSub: { fontSize: 7.5, color: GRAY_TEXT, marginTop: 1 },
  headerDate: { fontSize: 7, color: GRAY_TEXT },

  // ── Filter tags ────────────────────────────────────────────────────────────
  filterRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  filterTag: {
    borderWidth: 0.5, borderColor: ORANGE, borderRadius: 2,
    paddingHorizontal: 6, paddingVertical: 2, fontSize: 7, color: ORANGE,
  },

  // ── Section title ──────────────────────────────────────────────────────────
  sectionTitle: { fontSize: 8.5, fontWeight: 'bold', color: ORANGE, textAlign: 'right', marginBottom: 5 },

  // ── KPI table ─────────────────────────────────────────────────────────────
  // row-reverse: kpiLabel (first child) → right; kpiValue (second) → left
  kpiTable: { borderTopWidth: 0.5, borderTopColor: GRAY_LINE, marginBottom: 16 },
  kpiRow: {
    flexDirection: 'row-reverse', paddingVertical: 5,
    borderBottomWidth: 0.5, borderBottomColor: GRAY_LINE,
  },
  kpiRowAlt: {
    flexDirection: 'row-reverse', paddingVertical: 5,
    borderBottomWidth: 0.5, borderBottomColor: GRAY_LINE, backgroundColor: GRAY_BG,
  },
  kpiLabel: { fontSize: 8, color: GRAY_TEXT, flex: 1, textAlign: 'right' },
  kpiValue: { fontSize: 8, fontWeight: 'bold', color: BLACK, width: 90, textAlign: 'left' },
  kpiValueOrange: { fontSize: 8, fontWeight: 'bold', color: ORANGE, width: 90, textAlign: 'left' },

  // ── Data tables ───────────────────────────────────────────────────────────
  tableWrap: { marginTop: 14 },
  // row-reverse: columns listed in JSX order are placed right-to-left
  tableHeader: {
    flexDirection: 'row-reverse', backgroundColor: GRAY_BG,
    borderTopWidth: 0.5, borderTopColor: GRAY_LINE,
    borderBottomWidth: 1, borderBottomColor: BLACK,
    paddingVertical: 5, paddingHorizontal: 3,
  },
  th: { fontSize: 7, fontWeight: 'bold', color: BLACK, textAlign: 'right', paddingRight: 3 },
  tableRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 0.5, borderBottomColor: GRAY_LINE,
    paddingVertical: 5, paddingHorizontal: 3,
  },
  tableRowAlt: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 0.5, borderBottomColor: GRAY_LINE,
    paddingVertical: 5, paddingHorizontal: 3, backgroundColor: GRAY_BG,
  },
  td: { fontSize: 7, color: BLACK, textAlign: 'right', paddingRight: 3 },
  tdBold: { fontSize: 7, color: BLACK, fontWeight: 'bold', textAlign: 'right', paddingRight: 3 },
  tdOrange: { fontSize: 7, color: ORANGE, fontWeight: 'bold', textAlign: 'right', paddingRight: 3 },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute', bottom: 14, left: 28, right: 28,
    borderTopWidth: 0.5, borderTopColor: GRAY_LINE,
    paddingTop: 4, flexDirection: 'row-reverse', justifyContent: 'space-between',
  },
  footerText: { fontSize: 6, color: GRAY_TEXT },
})

interface Props {
  kpi: AnalyticsKPI
  userRows: UserStats[]
  logoUrl: string | null
  companyName: string
  generatedAt: string
  filters: { userId?: string; fromDate?: string; toDate?: string; quoteStatus?: string; paymentStatus?: string }
  filterUserName?: string
  rejectedRows?: RejectedRow[]
  overpayRows?: OverpayRow[]
}

export function AnalyticsPDF({ kpi, userRows, logoUrl, companyName, generatedAt, filters, filterUserName, rejectedRows, overpayRows }: Props) {
  const acceptedTotal = userRows.reduce((acc, r) => acc + r.acceptedAmount, 0)

  const activeFilters: string[] = []
  if (filterUserName) activeFilters.push(`משתמש: ${filterUserName}`)
  if (filters.fromDate) activeFilters.push(`מ: ${fmtDate(filters.fromDate)}`)
  if (filters.toDate) activeFilters.push(`עד: ${fmtDate(filters.toDate)}`)
  if (filters.quoteStatus) activeFilters.push(`סטטוס: ${filters.quoteStatus}`)
  if (filters.paymentStatus) activeFilters.push(`תשלום: ${filters.paymentStatus}`)

  const kpiItems = [
    { label: 'סה״כ הצעות',    value: String(kpi.totalCount),          orange: false },
    { label: 'אושרו',          value: String(kpi.acceptedCount),        orange: false },
    { label: 'שווי מאושר',    value: fmtCurrency(acceptedTotal),       orange: false },
    { label: 'שולם בפועל',    value: fmtCurrency(kpi.paidTotal),       orange: false },
    { label: 'יתרה פתוחה',    value: fmtCurrency(kpi.openBalance),     orange: true  },
    { label: 'יתרה שנסגרה',   value: fmtCurrency(kpi.closedAdjustment), orange: false },
    { label: 'הצעות עם חריגים', value: String(kpi.overpayCount),        orange: false },
    { label: 'סה״כ חריגים',    value: fmtCurrency(kpi.overpayTotal),   orange: false },
  ]

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        {/* row-reverse → brand block on RIGHT, date on LEFT */}
        <View style={s.pageHeader}>
          <View style={s.headerBrand}>
            {logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logoUrl} style={s.logo} />
            ) : null}
            <View style={s.headerTitles}>
              <Text style={s.headerTitle}>דוח ניתוח הצעות מחיר</Text>
              {companyName ? <Text style={s.headerSub}>{companyName}</Text> : null}
            </View>
          </View>
          <Text style={s.headerDate}>הופק: {generatedAt}</Text>
        </View>

        {/* ── Active filters ─────────────────────────────────────────────── */}
        {activeFilters.length > 0 && (
          <View style={s.filterRow}>
            {activeFilters.map((f, i) => (
              <View key={i} style={s.filterTag}><Text>{f}</Text></View>
            ))}
          </View>
        )}

        {/* ── KPI summary ────────────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>סיכום כללי</Text>
        <View style={s.kpiTable}>
          {kpiItems.map((k, i) => (
            <View key={i} style={i % 2 === 1 ? s.kpiRowAlt : s.kpiRow}>
              {/* row-reverse: label (first) on right, value (second) on left */}
              <Text style={s.kpiLabel}>{k.label}</Text>
              <Text style={k.orange ? s.kpiValueOrange : s.kpiValue}>{k.value}</Text>
            </View>
          ))}
        </View>

        {/* ── Table 1: Quote performance ─────────────────────────────────── */}
        {/* row-reverse: columns listed here appear right-to-left */}
        <View style={s.tableWrap}>
          <Text style={s.sectionTitle}>ביצועי הצעות לפי משתמש</Text>
          <View style={s.tableHeader}>
            <Text style={[s.th, { width: C1.name }]}>שם</Text>
            <Text style={[s.th, { width: C1.role }]}>תפקיד</Text>
            <Text style={[s.th, { width: C1.total }]}>סה״כ</Text>
            <Text style={[s.th, { width: C1.draft }]}>טיוטה</Text>
            <Text style={[s.th, { width: C1.sent }]}>נשלחה</Text>
            <Text style={[s.th, { width: C1.accepted }]}>אושרה</Text>
            <Text style={[s.th, { width: C1.rejected }]}>נדחתה</Text>
            <Text style={[s.th, { width: C1.archived }]}>בארכיון</Text>
          </View>
          {userRows.map((row, i) => (
            <View key={row.userId} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tdBold, { width: C1.name }]}>{row.name}</Text>
              <Text style={[s.td, { width: C1.role }]}>{row.role}</Text>
              <Text style={[s.td, { width: C1.total }]}>{row.total}</Text>
              <Text style={[s.td, { width: C1.draft }]}>{row.draft || '—'}</Text>
              <Text style={[s.td, { width: C1.sent }]}>{row.sent || '—'}</Text>
              <Text style={[s.td, { width: C1.accepted }]}>{row.accepted || '—'}</Text>
              <Text style={[s.td, { width: C1.rejected }]}>{row.rejected || '—'}</Text>
              <Text style={[s.td, { width: C1.archived }]}>{row.archived || '—'}</Text>
            </View>
          ))}
        </View>

        {/* ── Table 2: Financial data ────────────────────────────────────── */}
        <View style={s.tableWrap}>
          <Text style={s.sectionTitle}>נתוני גבייה לפי משתמש</Text>
          <View style={s.tableHeader}>
            <Text style={[s.th, { width: C2.name }]}>שם</Text>
            <Text style={[s.th, { width: C2.totalAmt }]}>שווי כולל</Text>
            <Text style={[s.th, { width: C2.acceptedAmt }]}>שווי מאושר</Text>
            <Text style={[s.th, { width: C2.paid }]}>שולם בפועל</Text>
            <Text style={[s.th, { width: C2.open }]}>יתרה פתוחה</Text>
            <Text style={[s.th, { width: C2.closed }]}>יתרה שנסגרה</Text>
            <Text style={[s.th, { width: C2.pct }]}>% גבייה</Text>
          </View>
          {userRows.map((row, i) => (
            <View key={row.userId} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tdBold, { width: C2.name }]}>{row.name}</Text>
              <Text style={[s.td, { width: C2.totalAmt }]}>{row.totalAmount > 0 ? fmtCurrency(row.totalAmount) : '—'}</Text>
              <Text style={[s.td, { width: C2.acceptedAmt }]}>{row.acceptedAmount > 0 ? fmtCurrency(row.acceptedAmount) : '—'}</Text>
              <Text style={[s.td, { width: C2.paid }]}>{row.paidTotal > 0 ? fmtCurrency(row.paidTotal) : '—'}</Text>
              <Text style={[s.tdOrange, { width: C2.open }]}>{row.openBalance > 0 ? fmtCurrency(row.openBalance) : '—'}</Text>
              <Text style={[s.td, { width: C2.closed }]}>{row.closedAdjustment > 0 ? fmtCurrency(row.closedAdjustment) : '—'}</Text>
              <Text style={[s.td, { width: C2.pct }]}>{row.acceptedAmount > 0 ? `${row.collectionPct}%` : '—'}</Text>
            </View>
          ))}
        </View>

        {/* ── Table 3: Rejected quotes ───────────────────────────────────── */}
        {rejectedRows && rejectedRows.length > 0 && (
          <View style={s.tableWrap}>
            <Text style={s.sectionTitle}>הצעות שנדחו</Text>
            <View style={s.tableHeader}>
              <Text style={[s.th, { width: C3.name }]}>לקוח</Text>
              <Text style={[s.th, { width: C3.date }]}>תאריך</Text>
              <Text style={[s.th, { width: C3.amount }]}>סכום</Text>
              <Text style={[s.th, { width: C3.reason }]}>סיבת דחייה</Text>
              <Text style={[s.th, { width: C3.user }]}>נשלח על ידי</Text>
            </View>
            {rejectedRows.map((row, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tdBold, { width: C3.name }]}>{row.clientName}</Text>
                <Text style={[s.td, { width: C3.date }]}>{fmtDate(row.quoteDate)}</Text>
                <Text style={[s.td, { width: C3.amount }]}>{row.amount > 0 ? fmtCurrency(row.amount) : '—'}</Text>
                <Text style={[s.td, { width: C3.reason }]}>{row.statusNote || '—'}</Text>
                <Text style={[s.td, { width: C3.user }]}>{row.userName}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Table 4: Overpay quotes ───────────────────────────────────── */}
        {overpayRows && overpayRows.length > 0 && (
          <View style={s.tableWrap}>
            <Text style={s.sectionTitle}>הצעות עם חריגים / תוספות</Text>
            <View style={s.tableHeader}>
              <Text style={[s.th, { width: C4.name }]}>לקוח</Text>
              <Text style={[s.th, { width: C4.date }]}>תאריך</Text>
              <Text style={[s.th, { width: C4.total }]}>סכום</Text>
              <Text style={[s.th, { width: C4.paid }]}>שולם</Text>
              <Text style={[s.th, { width: C4.note }]}>פירוט חריגים</Text>
              <Text style={[s.th, { width: C4.user }]}>נשלח על ידי</Text>
            </View>
            {overpayRows.map((row, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tdBold, { width: C4.name }]}>{row.clientName}</Text>
                <Text style={[s.td, { width: C4.date }]}>{fmtDate(row.quoteDate)}</Text>
                <Text style={[s.td, { width: C4.total }]}>{row.total > 0 ? fmtCurrency(row.total) : '—'}</Text>
                <Text style={[s.td, { width: C4.paid }]}>{fmtCurrency(row.paid)}</Text>
                <Text style={[s.td, { width: C4.note }]}>{row.overpaymentNote || '—'}</Text>
                <Text style={[s.td, { width: C4.user }]}>{row.userName}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{companyName ? `${companyName} — ` : ''}Field Quotes</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
