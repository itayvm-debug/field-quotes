// Paragraph-level notes format for quote item notes.
// Stored as JSON string in the existing notes text column — no DB schema change.
//
// Format: [{"text":"...", "bold":true}, ...]
//
// Backward-compatible: plain text, legacy HTML, and legacy Markdown are
// auto-converted to plain paragraphs when first loaded.

export interface NoteParagraph {
  text: string
  bold: boolean
}

// Parse any stored notes value into paragraphs.
// Handles: JSON (current format), plain text, legacy HTML, legacy Markdown.
export function parseNotes(raw: string | null | undefined): NoteParagraph[] {
  if (!raw || !raw.trim()) return [{ text: '', bold: false }]

  const trimmed = raw.trim()

  // Current JSON format
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((p) => typeof p.text === 'string' && typeof p.bold === 'boolean')
      ) {
        return parsed
      }
    } catch {
      // fall through to legacy handling
    }
  }

  // Legacy formats — strip HTML tags and Markdown markers, split by newlines
  const plain = trimmed
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()

  if (!plain) return [{ text: '', bold: false }]
  return plain.split('\n').map((line) => ({ text: line, bold: false }))
}

// Serialize paragraphs to JSON for storage.
// Returns '' when there is no meaningful content (all paragraphs are empty).
export function serializeNotes(paras: NoteParagraph[]): string {
  // Trim trailing empty paragraphs
  let end = paras.length - 1
  while (end > 0 && !paras[end].text.trim() && !paras[end].bold) end--
  const trimmed = paras.slice(0, end + 1)
  if (trimmed.length === 1 && !trimmed[0].text.trim() && !trimmed[0].bold) return ''
  return JSON.stringify(trimmed)
}
