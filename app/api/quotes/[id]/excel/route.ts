import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { parsePriceAdjustments, applyPriceAdjustments } from '@/lib/priceAdjustments'
import { calcVat, calcTotal } from '@/lib/calculations'
import { QUOTE_PRICING_TYPE_LABELS, STATUS_LABELS } from '@/types'
import { parseNotes } from '@/lib/notesFormat'

export const dynamic = 'force-dynamic'

// ── ARGB colour constants ────────────────────────────────────────────────────
const CLR = {
  orange     : 'FFF97316',  // brand orange title bar
  orangeLight: 'FFFFF7ED',  // section header bg
  tableHdr   : 'FFFFEDD5',  // items table header bg
  optional   : 'FFFFFBEB',  // optional item row bg
  summaryBg  : 'FFF9FAFB',  // summary section bg (gray-50)
  border     : 'FFE5E7EB',  // thin border
  labelGray  : 'FF6B7280',  // info-row label text
  bodyText   : 'FF111827',  // main text
  white      : 'FFFFFFFF',
  orangeText : 'FFea580c',  // section title text (orange-600)
}

const ILS_FMT = '₪#,##0.00'
const QTY_FMT = '#,##0.##'

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  const parts = d.split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function imgExt(path: string): 'jpeg' | 'png' | 'gif' {
  const e = path.split('.').pop()?.toLowerCase()
  if (e === 'jpg' || e === 'jpeg') return 'jpeg'
  if (e === 'gif') return 'gif'
  return 'png'
}

// Read pixel dimensions directly from a PNG / JPEG / GIF / WebP buffer.
// Returns null when the format is unrecognised — caller should fall back to a square.
function readImgDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null
  // PNG: signature 8 bytes, then IHDR chunk: 4 len + 4 "IHDR" + 4 width + 4 height
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }
  // GIF: "GIF8" header, width/height at bytes 6-9 (little-endian uint16)
  if (buf[0] === 0x47 && buf[1] === 0x49) {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) }
  }
  // JPEG: scan for SOF0/SOF1/SOF2 (0xFF 0xC0–0xC2) marker
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2
    while (i + 8 < buf.length) {
      if (buf[i] !== 0xFF) break
      const marker = buf[i + 1]
      if (marker >= 0xC0 && marker <= 0xC2) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) }
      }
      const segLen = buf.readUInt16BE(i + 2)
      i += 2 + segLen
    }
    return null
  }
  // WebP: "RIFF????WEBP"
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
    const chunkType = buf.slice(12, 16).toString('ascii')
    if (chunkType === 'VP8 ' && buf.length >= 30) {
      return { w: (buf.readUInt16LE(26) & 0x3FFF) + 1, h: (buf.readUInt16LE(28) & 0x3FFF) + 1 }
    }
    if (chunkType === 'VP8L' && buf.length >= 25) {
      const bits = buf.readUInt32LE(21)
      return { w: (bits & 0x3FFF) + 1, h: ((bits >> 14) & 0x3FFF) + 1 }
    }
  }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dlBuf(supabase: any, bucket: string, path: string): Promise<Buffer | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path)
    if (error || !data) return null
    return Buffer.from(await (data as Blob).arrayBuffer())
  } catch { return null }
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function thinBorders(argb = CLR.border): Partial<ExcelJS.Borders> {
  const s = { style: 'thin' as ExcelJS.BorderStyle, color: { argb } }
  return { top: s, bottom: s, left: s, right: s }
}

function rtlMid(horizontal: ExcelJS.Alignment['horizontal'] = 'right'): Partial<ExcelJS.Alignment> {
  return { horizontal, vertical: 'middle', readingOrder: 'rtl' }
}

// ── Row-height estimation ─────────────────────────────────────────────────────
// Column widths (char units) for the two wrapping columns — must match colDefs below.
const COL_W_DESC  = 45
const COL_W_NOTES = 35
// Height constants (points)
const ROW_H_BASE  = 20   // minimum item row height
const ROW_H_IMAGE = 80   // row height when images are present (≈107 px)
const LINE_PT     = 15   // points per wrapped text line
const LINE_PAD    = 6    // top + bottom cell padding

// How many display lines will `text` require in a column of `colW` char-units wide?
// Accounts for explicit \n and line-wrap; uses 0.9× char-units as chars-per-line.
function estimateWrappedLines(text: string, colW: number): number {
  if (!text) return 1
  const cpl = Math.max(8, Math.floor(colW * 0.9))
  return text.split('\n').reduce(
    (sum, line) => sum + Math.max(1, Math.ceil((line.length || 1) / cpl)),
    0
  )
}

// Extract plain text from stored notes (all bold/non-bold segments joined) for height estimation.
function notesPlainText(raw: string | null | undefined): string {
  if (!raw?.trim()) return ''
  try { return parseNotes(raw).map(p => p.text).filter(Boolean).join('\n') }
  catch { return '' }
}

// Convert 1-based column index to Excel letter (A, B, ..., Z, AA, ...)
function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// Convert stored notes (JSON paragraphs OR plain text) → ExcelJS cell value.
// Returns rich text when any paragraph is bold, plain string otherwise.
// Returns null (not '') for empty notes so ExcelJS writes a truly empty cell.
function notesToExcelValue(raw: string | null | undefined): string | ExcelJS.CellRichTextValue | null {
  if (!raw?.trim()) return null

  let paras
  try {
    paras = parseNotes(raw)
  } catch {
    return raw // absolute fallback — should never happen
  }

  // Drop trailing all-empty paragraphs
  let end = paras.length - 1
  while (end > 0 && !paras[end].text) end--
  const active = paras.slice(0, end + 1)

  if (active.length === 0 || (active.length === 1 && !active[0].text)) return null

  // If no paragraph has bold, a plain joined string is enough
  const anyBold = active.some(p => p.bold)
  if (!anyBold) return active.map(p => p.text).join('\n')

  // Build ExcelJS rich text: each paragraph is one segment, separated by '\n' segments
  const richText: ExcelJS.RichText[] = []
  for (let i = 0; i < active.length; i++) {
    if (i > 0) richText.push({ text: '\n', font: { name: 'Arial', size: 10 } })
    if (active[i].text) {
      richText.push({
        text: active[i].text,
        font: { name: 'Arial', size: 10, bold: active[i].bold },
      })
    }
  }
  return richText.length > 0 ? { richText } : null
}

// ── main handler ─────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch quote + items + item images
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote, error: qErr } = await (supabase as any)
    .from('quotes')
    .select('*, quote_items(*, item_images(*))')
    .eq('id', id)
    .single()
  if (qErr || !quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Company settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: company } = await (supabase as any)
    .from('company_settings')
    .select('company_name, company_id_number, address, phone, email, logo_storage_path')
    .single()

  // Creator profile
  let creator: { full_name: string; job_title?: string } | null = null
  if (quote.user_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: p } = await (supabase as any)
      .from('profiles').select('full_name, job_title').eq('id', quote.user_id).single()
    if (p) creator = p
  }

  // Sort items by item_number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems: any[] = ((quote.quote_items ?? []) as any[]).sort(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any, b: any) => (a.item_number ?? 0) - (b.item_number ?? 0)
  )

  // Download company logo and compute display size preserving aspect ratio
  let logoBuf: Buffer | null = null
  let logoExt: 'jpeg' | 'png' | 'gif' = 'png'
  let logoTargetW = 0
  let logoTargetH = 0
  if (company?.logo_storage_path) {
    logoBuf = await dlBuf(supabase, 'company-assets', company.logo_storage_path)
    if (logoBuf) {
      logoExt = imgExt(company.logo_storage_path)
      const dims = readImgDims(logoBuf)
      logoTargetH = 48
      logoTargetW = dims
        ? Math.round(logoTargetH * (dims.w / dims.h))
        : logoTargetH  // square fallback when format unrecognised
    }
  }

  // Download project image
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projPath = (quote as any).project_image_path as string | null
  const projBuf  = projPath ? await dlBuf(supabase, 'quote-images', projPath) : null

  // Download all item images in parallel
  const itemsWithImgs: Array<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any
    imgs: Array<{ buf: Buffer; ext: 'jpeg' | 'png' | 'gif' } | null>
  }> = await Promise.all(
    rawItems.map(async (item) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sorted = ((item.item_images ?? []) as any[]).sort(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0)
      )
      const imgs = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sorted.map(async (img: any) => {
          if (!img.storage_path) return null
          const buf = await dlBuf(supabase, 'quote-images', img.storage_path)
          if (!buf) return null
          return { buf, ext: imgExt(img.storage_path) }
        })
      )
      return { item, imgs }
    })
  )

  // ── Price calculations ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requiredItems = rawItems.filter((i: any) => !i.is_optional)
  const subtotal = requiredItems.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: number, i: any) => s + parseFloat(i.quantity) * parseFloat(i.unit_price), 0
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adjResult = applyPriceAdjustments(subtotal, parsePriceAdjustments((quote as any).price_adjustments))
  const adjustedSubtotal = adjResult.adjustedTotal
  const vatPct = parseFloat(String(quote.vat_percentage ?? 0))
  const vatAmt = calcVat(adjustedSubtotal, vatPct)
  const total  = calcTotal(adjustedSubtotal, vatAmt)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optItems     = rawItems.filter((i: any) => i.is_optional)
  const hasOpt       = optItems.length > 0
  const optSubtotal  = optItems.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: number, i: any) => s + parseFloat(i.quantity) * parseFloat(i.unit_price), 0
  )
  const optVat       = calcVat(optSubtotal, vatPct)
  const grandTotal   = calcTotal(total + optSubtotal, optVat)

  // ── Build workbook ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = company?.company_name ?? ''
  wb.created = new Date()

  const maxImgCols = Math.max(0, ...itemsWithImgs.map(d => d.imgs.filter(Boolean).length))

  // Column indices (1-based)
  const C_NUM   = 1   // A  item number / right-margin in header
  const C_LBL   = 2   // B  optional / info label
  const C_DESC  = 3   // C  description / info value (merged to LAST)
  const C_UNIT  = 4   // D  unit
  const C_QTY   = 5   // E  qty
  const C_PRICE = 6   // F  unit price
  const C_TOTAL = 7   // G  total
  const C_NOTES = 8   // H  notes
  const C_IMG0  = 9   // I  first image column
  const LAST_COL = maxImgCols > 0 ? C_IMG0 + maxImgCols - 1 : C_NOTES

  const ws = wb.addWorksheet('הצעת מחיר', {
    views: [{ rightToLeft: true }],
    properties: { defaultRowHeight: 18 },
  })

  // ── Column widths ─────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colDefs: any[] = [
    { width: 7  },  // A: item#
    { width: 20 },  // B: label / optional
    { width: 45 },  // C: description / value
    { width: 10 },  // D: unit
    { width: 9  },  // E: qty
    { width: 14 },  // F: unit price
    { width: 14 },  // G: total
    { width: 35 },  // H: notes
  ]
  for (let i = 0; i < maxImgCols; i++) colDefs.push({ width: 20 })
  ws.columns = colDefs

  let rowNum = 1

  // ── Helpers ───────────────────────────────────────────────────────────────
  function mergeR(r: number, c1: number, c2: number) {
    if (c2 > c1) ws.mergeCells(r, c1, r, c2)
  }

  function titleRow(text: string) {
    mergeR(rowNum, 1, LAST_COL)
    const c = ws.getCell(rowNum, 1)
    c.value = text
    c.font  = { name: 'Arial', size: 14, bold: true, color: { argb: CLR.white } }
    c.fill  = solidFill(CLR.orange)
    c.alignment = rtlMid()
    // px → pt: 1px = 0.75pt at 96dpi; add 6pt padding so the logo isn't clipped
    ws.getRow(rowNum).height = logoBuf ? Math.ceil(logoTargetH * 0.75) + 6 : 30
    rowNum++
  }

  function subtitleRow(text: string) {
    mergeR(rowNum, 1, LAST_COL)
    const c = ws.getCell(rowNum, 1)
    c.value = text
    c.font  = { name: 'Arial', size: 11, bold: true, color: { argb: CLR.orange } }
    c.fill  = solidFill(CLR.orangeLight)
    c.alignment = rtlMid()
    ws.getRow(rowNum).height = 22
    rowNum++
  }

  function sectionHeader(text: string) {
    mergeR(rowNum, 1, LAST_COL)
    const c = ws.getCell(rowNum, 1)
    c.value = text
    c.font  = { name: 'Arial', size: 10, bold: true, color: { argb: CLR.orangeText } }
    c.fill  = solidFill(CLR.orangeLight)
    c.alignment = rtlMid()
    c.border = thinBorders()
    ws.getRow(rowNum).height = 20
    rowNum++
  }

  // info label-value row (B=label, C..LAST merged=value)
  function infoRow(label: string, value: string | null | undefined, wrap = false) {
    if (!value?.trim()) return
    const row = ws.getRow(rowNum)
    row.height = wrap ? 36 : 18
    const lc = ws.getCell(rowNum, C_LBL)
    lc.value = label
    lc.font  = { name: 'Arial', size: 10, bold: true, color: { argb: CLR.labelGray } }
    lc.alignment = rtlMid()
    mergeR(rowNum, C_DESC, LAST_COL)
    const vc = ws.getCell(rowNum, C_DESC)
    vc.value = value
    vc.font  = { name: 'Arial', size: 10, color: { argb: CLR.bodyText } }
    vc.alignment = wrap
      ? { horizontal: 'right', vertical: 'top', wrapText: true, readingOrder: 'rtl' }
      : rtlMid()
    rowNum++
  }

  function emptyRow(h = 8) {
    ws.getRow(rowNum).height = h
    rowNum++
  }

  // ── WORKSHEET HEADER ──────────────────────────────────────────────────────
  titleRow(company?.company_name ?? 'הצעת מחיר')

  // Logo: embedded in the title row at the upper-left (high column = visual left in RTL)
  if (logoBuf) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logoId = wb.addImage({ buffer: logoBuf as any, extension: logoExt })
    ws.addImage(logoId, {
      tl: { col: LAST_COL - 0.8, row: 0.1 },  // 0-based fractional; LAST_COL-1 is visual-left in RTL
      ext: { width: logoTargetW, height: logoTargetH },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editAs: 'oneCell' as any,
    })
  }

  subtitleRow('הצעת מחיר')
  emptyRow()

  // Quote details
  sectionHeader('פרטי ההצעה')
  infoRow('מספר הצעה:', quote.quote_number)
  infoRow('סטטוס:', STATUS_LABELS[quote.status as keyof typeof STATUS_LABELS] ?? quote.status)
  infoRow('תאריך הצעה:', fmtDate(quote.quote_date))
  infoRow('בתוקף עד:', fmtDate(quote.valid_until))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pricingType = (quote as any).quote_pricing_type as string | null
  if (pricingType) {
    infoRow('סוג הצעה:', QUOTE_PRICING_TYPE_LABELS[pricingType] ?? pricingType)
  }
  emptyRow()

  // Client details
  sectionHeader('פרטי לקוח')
  infoRow('שם לקוח:', quote.client_name)
  infoRow('איש קשר:', quote.client_contact)
  infoRow('כתובת עבודה:', quote.client_address)
  if (quote.project_description?.trim()) {
    infoRow('תיאור פרויקט:', quote.project_description, true)
  }
  if (creator) {
    const name = creator.full_name + (creator.job_title ? ` — ${creator.job_title}` : '')
    infoRow('יוצר ההצעה:', name)
  }
  if (company?.address?.trim()) infoRow('כתובת חברה:', company.address)
  if (company?.phone?.trim())   infoRow('טלפון:', company.phone)
  emptyRow()

  // ── PROJECT IMAGE ─────────────────────────────────────────────────────────
  if (projBuf && projPath) {
    sectionHeader('תמונת פרויקט')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgId = wb.addImage({ buffer: projBuf as any, extension: imgExt(projPath) })
    const imgRowH = 150  // points ≈ 200px
    ws.getRow(rowNum).height = imgRowH
    ws.addImage(imgId, {
      tl: { col: C_LBL - 1, row: rowNum - 1 },  // 0-based
      ext: { width: 260, height: 195 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editAs: 'oneCell' as any,
    })
    rowNum++
    emptyRow()
  }

  // ── ITEMS TABLE ───────────────────────────────────────────────────────────
  sectionHeader('פריטי ההצעה')
  const tableHeaderRowNum = rowNum

  // Table header cells
  const hRow = ws.getRow(rowNum)
  hRow.height = 22

  const headers: Array<{ col: number; text: string; numFmt?: string; width?: number }> = [
    { col: C_NUM,   text: 'מס\'' },
    { col: C_LBL,   text: 'אופציה' },
    { col: C_DESC,  text: 'תיאור עבודה' },
    { col: C_UNIT,  text: 'יח\' מידה' },
    { col: C_QTY,   text: 'כמות' },
    { col: C_PRICE, text: 'מחיר יחידה' },
    { col: C_TOTAL, text: 'סה"כ' },
    { col: C_NOTES, text: 'הערות' },
  ]
  for (let i = 0; i < maxImgCols; i++) {
    headers.push({ col: C_IMG0 + i, text: `תמונה ${i + 1}` })
  }

  for (const { col, text } of headers) {
    const c = ws.getCell(rowNum, col)
    c.value = text
    c.font  = { name: 'Arial', size: 10, bold: true, color: { argb: CLR.bodyText } }
    c.fill  = solidFill(CLR.tableHdr)
    c.alignment = rtlMid('center')
    c.border = thinBorders()
  }
  rowNum++

  // AutoFilter on header row
  ws.autoFilter = {
    from: { row: tableHeaderRowNum, column: C_NUM },
    to:   { row: tableHeaderRowNum, column: LAST_COL },
  }

  // Item rows
  const firstItemRow = rowNum
  for (const { item, imgs } of itemsWithImgs) {
    const isOpt   = item.is_optional ?? false
    const qty     = parseFloat(item.quantity)
    const price   = parseFloat(item.unit_price)
    const itemTotal = Math.round(qty * price * 100) / 100
    const bgArgb  = isOpt ? CLR.optional : CLR.white

    // Dynamic row height: max of description height, notes height, image height
    const descH  = LINE_PAD + estimateWrappedLines(item.description ?? '', COL_W_DESC)  * LINE_PT
    const npt    = notesPlainText(item.notes)
    const notesH = npt ? LINE_PAD + estimateWrappedLines(npt, COL_W_NOTES) * LINE_PT : 0
    const hasImgs = imgs.some(Boolean)
    const rowH   = Math.max(ROW_H_BASE, descH, notesH, hasImgs ? ROW_H_IMAGE : 0)
    const r = ws.getRow(rowNum)
    r.height = rowH

    const cells: Array<{ col: number; val: ExcelJS.CellValue; numFmt?: string; wrap?: boolean; bold?: boolean }> = [
      { col: C_NUM,   val: item.item_number },
      { col: C_LBL,   val: isOpt ? 'כן' : null, bold: isOpt },
      { col: C_DESC,  val: item.description, wrap: true },
      { col: C_UNIT,  val: item.unit },
      { col: C_QTY,   val: qty,   numFmt: QTY_FMT },
      { col: C_PRICE, val: price, numFmt: ILS_FMT },
      { col: C_TOTAL, val: { formula: `=E${rowNum}*F${rowNum}`, result: itemTotal }, numFmt: ILS_FMT },
      { col: C_NOTES, val: notesToExcelValue(item.notes), wrap: true },
    ]

    for (const { col, val, numFmt, wrap, bold } of cells) {
      const c = ws.getCell(rowNum, col)
      c.value = val
      c.font  = { name: 'Arial', size: 10, bold: bold ?? false, color: { argb: CLR.bodyText } }
      c.fill  = solidFill(bgArgb)
      c.alignment = { horizontal: 'right', vertical: 'top', wrapText: wrap ?? false, readingOrder: 'rtl' }
      c.border = thinBorders()
      if (numFmt) c.numFmt = numFmt
    }

    // Image columns: fill bg only
    for (let i = 0; i < maxImgCols; i++) {
      const ic = ws.getCell(rowNum, C_IMG0 + i)
      ic.fill   = solidFill(bgArgb)
      ic.border = thinBorders()
    }

    // Embed item images
    for (let imgIdx = 0; imgIdx < imgs.length; imgIdx++) {
      const img = imgs[imgIdx]
      if (!img) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imgId = wb.addImage({ buffer: img.buf as any, extension: img.ext })
      ws.addImage(imgId, {
        tl: { col: C_IMG0 + imgIdx - 1, row: rowNum - 1 },  // 0-based
        ext: { width: 120, height: 90 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editAs: 'oneCell' as any,
      })
    }

    rowNum++
  }

  const lastItemRow = rowNum - 1
  emptyRow()

  // ── FINANCIAL SUMMARY ─────────────────────────────────────────────────────
  sectionHeader('סיכום כספי')

  // Helper: summary row (label in C-E merged, amount in F-G merged)
  function summaryRow(label: string, amount: number | null, bold = false, bg = CLR.summaryBg) {
    mergeR(rowNum, C_DESC, C_QTY)
    mergeR(rowNum, C_PRICE, C_TOTAL)
    mergeR(rowNum, 1, C_LBL)

    const lc = ws.getCell(rowNum, C_DESC)
    lc.value = label
    lc.font  = { name: 'Arial', size: 10, bold, color: { argb: CLR.bodyText } }
    lc.fill  = solidFill(bg)
    lc.alignment = rtlMid()
    lc.border = thinBorders()

    const ac = ws.getCell(rowNum, C_PRICE)
    ac.value = amount
    ac.font  = { name: 'Arial', size: 10, bold, color: { argb: CLR.bodyText } }
    ac.fill  = solidFill(bg)
    ac.alignment = rtlMid()
    ac.border = thinBorders()
    if (amount !== null) ac.numFmt = ILS_FMT

    // Fill remaining cols
    for (let col = C_NOTES; col <= LAST_COL; col++) {
      const c = ws.getCell(rowNum, col)
      c.fill   = solidFill(bg)
      c.border = thinBorders()
    }
    ws.getRow(rowNum).height = 18
    rowNum++
  }

  summaryRow('סה"כ לפני הנחות/תוספות', subtotal)

  for (const adj of adjResult.adjustments) {
    const sign   = adj.type === 'addition' ? '+' : '-'
    const label  = `${adj.name} (${sign}${adj.percentage}%)`
    summaryRow(label, adj.type === 'addition' ? adj.amount : -adj.amount)
  }

  if (adjResult.adjustments.length > 0) {
    summaryRow('סה"כ אחרי התאמות', adjustedSubtotal, true)
  }

  summaryRow(`מע"מ (${vatPct}%)`, vatAmt)
  summaryRow('סה"כ לתשלום לביצוע', total, true, CLR.orangeLight)

  if (hasOpt) {
    emptyRow(6)
    summaryRow('סה"כ סעיפי אופציה (ללא מע"מ)', optSubtotal)
    summaryRow(`מע"מ על אופציות (${vatPct}%)`, optVat)
    summaryRow('סה"כ כולל אופציות', grandTotal, true, CLR.orangeLight)
  }

  emptyRow()

  // ── PAYMENT TERMS ─────────────────────────────────────────────────────────
  if (quote.payment_terms?.trim()) {
    sectionHeader('תנאי תשלום')
    mergeR(rowNum, 1, LAST_COL)
    const c = ws.getCell(rowNum, 1)
    c.value = quote.payment_terms
    c.font  = { name: 'Arial', size: 10, color: { argb: CLR.bodyText } }
    c.alignment = { horizontal: 'right', vertical: 'top', wrapText: true, readingOrder: 'rtl' }
    const lines = quote.payment_terms.split('\n').length
    ws.getRow(rowNum).height = Math.max(18, lines * 16)
    rowNum++
    emptyRow()
  }

  // ── EXCLUSIONS / NOTES ────────────────────────────────────────────────────
  if (quote.exclusions?.trim()) {
    sectionHeader('החרגות / הערות')
    mergeR(rowNum, 1, LAST_COL)
    const c = ws.getCell(rowNum, 1)
    c.value = quote.exclusions
    c.font  = { name: 'Arial', size: 10, color: { argb: CLR.bodyText } }
    c.alignment = { horizontal: 'right', vertical: 'top', wrapText: true, readingOrder: 'rtl' }
    const lines = quote.exclusions.split('\n').length
    ws.getRow(rowNum).height = Math.max(18, lines * 16)
    rowNum++
  }

  // ── VIEWS + PRINT SETUP ───────────────────────────────────────────────────
  // RTL only — no freeze pane
  ws.views = [{ rightToLeft: true }]

  ws.pageSetup.orientation    = 'landscape'
  ws.pageSetup.paperSize      = 9   // A4
  ws.pageSetup.fitToPage      = true
  ws.pageSetup.fitToWidth     = 1   // fit all columns to one page wide
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(ws.pageSetup as any).fitToHeight = 0  // unlimited pages tall
  ws.pageSetup.printArea      = `A1:${colLetter(LAST_COL)}${rowNum - 1}`
  ws.pageSetup.printTitlesRow = `${tableHeaderRowNum}:${tableHeaderRowNum}`
  ws.pageSetup.margins        = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }

  // Suppress unused-variable warnings
  void firstItemRow
  void lastItemRow

  // ── Write + respond ───────────────────────────────────────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = Buffer.from(await wb.xlsx.writeBuffer() as any)
    const num = (quote.quote_number ?? '').replace(/[/\\:*?"<>|]/g, '').trim()
    const filename = num
      ? `natan-valdman-price-quote-${num}.xlsx`
      : 'natan-valdman-price-quote.xlsx'

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[excel] generation error:', msg)
    return NextResponse.json({ error: 'Excel generation failed', details: msg }, { status: 500 })
  }
}
