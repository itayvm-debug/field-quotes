'use client'

import { useRef, useEffect, useCallback } from 'react'

// ── Markdown ↔ HTML ────────────────────────────────────────────────────────────
// Storage format: Markdown (**bold**, __underline__, \n for newlines)
// Display format: HTML (<strong>, <u>, <br>)

function mdToHtml(md: string): string {
  if (!md) return ''
  return md
    .split('\n')
    .map((line) => {
      // Escape HTML entities first, then apply formatting so tags aren't escaped
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

// Walk the live DOM and serialize back to Markdown.
// Handles the various tags that execCommand may produce across browsers.
function htmlToMd(el: HTMLElement): string {
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const elem = node as HTMLElement
    const tag = elem.tagName.toLowerCase()
    const inner = Array.from(elem.childNodes).map(walk).join('')
    if (tag === 'strong' || tag === 'b') return `**${inner}**`
    if (tag === 'u') return `__${inner}__`
    if (tag === 'span') {
      const style = elem.getAttribute('style') ?? ''
      if (style.includes('text-decoration') && style.includes('underline')) return `__${inner}__`
      if (style.includes('font-weight') && style.includes('bold')) return `**${inner}**`
      return inner
    }
    if (tag === 'br') return '\n'
    // Chrome sometimes wraps new lines in <div>/<p> despite our Enter interception
    if (tag === 'div' || tag === 'p') return inner ? `\n${inner}` : '\n'
    return inner
  }
  return Array.from(el.childNodes)
    .map(walk)
    .join('')
    .replace(/^\n+/, '')   // strip leading newlines
    .replace(/\n+$/, '')   // strip trailing newlines
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  value: string                     // markdown-formatted string (stored in DB)
  onChange: (value: string) => void
  placeholder?: string
}

export function RichNotesEditor({ value, onChange, placeholder = 'הערות לסעיף זה...' }: Props) {
  const editorRef  = useRef<HTMLDivElement>(null)
  const lastMd     = useRef(value)   // tracks last synced markdown to avoid spurious updates
  const composing  = useRef(false)   // true during IME composition (Hebrew, etc.)

  // Populate editor HTML from Markdown on first mount only
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = mdToHtml(value)
      lastMd.current = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-sync if parent changes value while editor is not focused (e.g., initial quote load)
  useEffect(() => {
    if (
      value !== lastMd.current &&
      editorRef.current &&
      document.activeElement !== editorRef.current
    ) {
      editorRef.current.innerHTML = mdToHtml(value)
      lastMd.current = value
    }
  }, [value])

  const sync = useCallback(() => {
    if (!editorRef.current) return
    const md = htmlToMd(editorRef.current)
    if (md !== lastMd.current) {
      lastMd.current = md
      onChange(md)
    }
  }, [onChange])

  // execCommand('bold'/'underline') has built-in toggle: removes formatting when already applied.
  // onMouseDown + e.preventDefault() keeps editor focus so the selection stays intact.
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
      // Insert <br> to keep a flat DOM structure (avoids browser-specific <div>/<p> wrapping)
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
