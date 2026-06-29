// Parsed segment for rich-text notes.
// Plain text preserves newlines; bold/underline markers cannot span lines.
export interface TextSegment {
  text: string
  bold?: boolean
  underline?: boolean
}

// Splits text into segments by **bold** and __underline__ markers.
// Newlines inside markers are forbidden — they remain in plain-text segments.
export function parseFormattedText(text: string): TextSegment[] {
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
