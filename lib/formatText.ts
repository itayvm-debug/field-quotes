// Text segment for rich-text notes.
// Newlines are represented as { text: '\n' }.
// Bold/underline cannot span line boundaries.
export interface TextSegment {
  text: string
  bold?: boolean
  underline?: boolean
}

// ── HTML entity helpers ───────────────────────────────────────────────────────

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

// ── HTML parser (current storage format) ─────────────────────────────────────
// Parses sanitized HTML produced by RichNotesEditor's sanitizeHtml():
//   <strong>, <u>, <strong><u>…</u></strong>, <u><strong>…</strong></u>, <br>, text
// Newlines are emitted as { text: '\n' }.
// Works in Node.js/PDF context — no DOM required.

function parseHtmlToSegments(html: string): TextSegment[] {
  if (!html) return []
  const result: TextSegment[] = []
  // Alternatives (checked left-to-right):
  //   <strong><u>…</u></strong>  or  <u><strong>…</strong></u> → bold + underline
  //   <strong>…</strong>                                        → bold
  //   <u>…</u>                                                  → underline
  //   <br> / <br/>                                              → newline
  //   <anything>                                                → skip unknown tag
  //   plain text chunk                                          → plain
  const re = /<strong><u>([\s\S]*?)<\/u><\/strong>|<u><strong>([\s\S]*?)<\/strong><\/u>|<strong>([\s\S]*?)<\/strong>|<u>([\s\S]*?)<\/u>|<br\s*\/?>|<[^>]*>|([^<]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m[0] === '') continue
    if (m[1] !== undefined) {
      if (m[1]) result.push({ text: decodeHtmlEntities(m[1]), bold: true, underline: true })
    } else if (m[2] !== undefined) {
      if (m[2]) result.push({ text: decodeHtmlEntities(m[2]), bold: true, underline: true })
    } else if (m[3] !== undefined) {
      if (m[3]) result.push({ text: decodeHtmlEntities(m[3]), bold: true })
    } else if (m[4] !== undefined) {
      if (m[4]) result.push({ text: decodeHtmlEntities(m[4]), underline: true })
    } else if (/^<br/i.test(m[0])) {
      result.push({ text: '\n' })
    } else if (m[5]) {
      result.push({ text: decodeHtmlEntities(m[5]) })
    }
    // unknown <tag> is silently skipped (consumed by <[^>]*>)
  }
  return result
}

// ── Markdown parser (legacy storage format) ───────────────────────────────────
// Parses **bold** and __underline__; literal \n in text segments = line break.

function parseMarkdownToSegments(text: string): TextSegment[] {
  const result: TextSegment[] = []
  const re = /(\*\*[^*\n]+\*\*|__[^_\n]+__)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) result.push({ text: text.slice(last, m.index) })
    const token = m[0]
    if (token.startsWith('**')) {
      result.push({ text: token.slice(2, -2), bold: true })
    } else {
      result.push({ text: token.slice(2, -2), underline: true })
    }
    last = re.lastIndex
  }
  if (last < text.length) result.push({ text: text.slice(last) })
  return result.length > 0 ? result : [{ text }]
}

// ── Public API ────────────────────────────────────────────────────────────────
// Auto-detects storage format (sanitized HTML or legacy Markdown) and parses
// into segments. Call sites do not need to know which format is in use.

export function parseFormattedText(text: string): TextSegment[] {
  if (!text) return []
  // HTML format: contains at least one <strong>, <u>, or <br> tag
  if (/<(strong|u|br)\b/i.test(text)) {
    return parseHtmlToSegments(text)
  }
  // Legacy Markdown format (or plain text with no formatting)
  return parseMarkdownToSegments(text)
}
