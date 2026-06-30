'use client'

import { useRef, useEffect, useCallback } from 'react'

// ── HTML sanitizer ────────────────────────────────────────────────────────────
// Walks the live contenteditable DOM and produces safe, flat HTML.
// Allowed output tags: <strong>, <u>, <strong><u>…</u></strong>, <br>.
// Everything else (div, p, b, span, etc.) is unwrapped — but bold/underline
// context inherited from ancestor elements is propagated to text nodes.

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sanitizeHtml(el: HTMLElement): string {
  function walk(node: Node, bold: boolean, underline: boolean): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = escapeHtml(node.textContent ?? '')
      if (!text) return ''
      if (bold && underline) return `<strong><u>${text}</u></strong>`
      if (bold) return `<strong>${text}</strong>`
      if (underline) return `<u>${text}</u>`
      return text
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const elem = node as HTMLElement
    const tag = elem.tagName.toLowerCase()

    if (tag === 'br') return '<br>'

    const style = elem.getAttribute('style') ?? ''
    const isBold =
      bold || tag === 'strong' || tag === 'b' ||
      /font-weight\s*:\s*(bold|700)/i.test(style)
    const isUnderline =
      underline || tag === 'u' ||
      /text-decoration\s*:.*underline/i.test(style)

    const inner = Array.from(elem.childNodes)
      .map(c => walk(c, isBold, isUnderline))
      .join('')

    // Chrome sometimes wraps continuation lines in <div>/<p> despite our Enter
    // interception — prepend <br> so line breaks are preserved.
    if (tag === 'div' || tag === 'p') return inner ? `<br>${inner}` : ''
    return inner
  }

  return Array.from(el.childNodes)
    .map(node => walk(node, false, false))
    .join('')
    .replace(/^(<br>)+/, '')   // strip leading <br>
    .replace(/(<br>)+$/, '')   // strip trailing <br>
}

// ── Load helper ───────────────────────────────────────────────────────────────
// Converts any stored notes value to display HTML for the contenteditable.
// Handles both current (sanitized HTML) and legacy (Markdown) formats.

function loadHtml(value: string): string {
  if (!value) return ''
  // Current format: already sanitized HTML
  if (/<(strong|u|br)\b/i.test(value)) return value
  // Legacy Markdown: convert **bold** → <strong>, __u__ → <u>, \n → <br>
  return value
    .split('\n')
    .map((line) => {
      const safe = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      return safe
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_\n]+)__/g, '<u>$1</u>')
    })
    .join('<br>')
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  value: string                      // stored as sanitized HTML (or legacy Markdown)
  onChange: (value: string) => void
  placeholder?: string
}

export function RichNotesEditor({ value, onChange, placeholder = 'הערות לסעיף זה...' }: Props) {
  const editorRef  = useRef<HTMLDivElement>(null)
  const lastHtml   = useRef(value)   // last value passed to onChange (HTML or legacy Markdown)
  const composing  = useRef(false)   // true during IME composition (Hebrew, etc.)

  // Initialize editor HTML from stored value on first mount only
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = loadHtml(value)
      lastHtml.current = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-sync if parent changes value while editor is not focused (e.g., initial quote load)
  useEffect(() => {
    if (
      value !== lastHtml.current &&
      editorRef.current &&
      document.activeElement !== editorRef.current
    ) {
      editorRef.current.innerHTML = loadHtml(value)
      lastHtml.current = value
    }
  }, [value])

  const sync = useCallback(() => {
    if (!editorRef.current) return
    const html = sanitizeHtml(editorRef.current)
    if (html !== lastHtml.current) {
      lastHtml.current = html
      onChange(html)
    }
  }, [onChange])

  // execCommand has built-in toggle: removes formatting when already applied.
  // onMouseDown + e.preventDefault() keeps editor focus so selection stays intact.
  const applyFormat = (cmd: 'bold' | 'underline') => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(cmd, false)
    sync()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Insert <br> to keep flat DOM structure (avoids browser div/p wrapping)
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand('insertLineBreak')
      sync()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    // Accept only plain text — prevents injecting arbitrary HTML
    const text = e.clipboardData.getData('text/plain')
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand('insertText', false, text)
    sync()
  }

  return (
    <div className="mb-3">
      {/* Label + toolbar */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); applyFormat('bold') }}
            className="font-bold text-xs px-2 py-0.5 border border-gray-200 rounded text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            title="הדגשה (סמן טקסט ולחץ)"
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); applyFormat('underline') }}
            className="underline text-xs px-2 py-0.5 border border-gray-200 rounded text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            title="קו תחתון (סמן טקסט ולחץ)"
          >
            U
          </button>
        </div>
        <span className="text-xs text-gray-500">הערות (אופציונלי)</span>
      </div>

      {/* Editor */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          dir="rtl"
          role="textbox"
          aria-multiline="true"
          aria-label="הערות"
          suppressContentEditableWarning
          onInput={() => { if (!composing.current) sync() }}
          onCompositionStart={() => { composing.current = true }}
          onCompositionEnd={() => { composing.current = false; sync() }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="w-full min-h-[76px] border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        {/* Placeholder — shown when notes are empty */}
        {!value && (
          <span className="absolute top-2.5 right-3 text-sm text-gray-400 pointer-events-none select-none">
            {placeholder}
          </span>
        )}
      </div>
    </div>
  )
}
