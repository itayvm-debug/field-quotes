'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// Only these columns are allowed — prevents arbitrary DB column access.
const ALLOWED_FIELDS = ['client_name', 'client_address', 'client_contact'] as const
type SuggestionField = typeof ALLOWED_FIELDS[number]

interface Props {
  field: SuggestionField
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function FieldAutocomplete({ field, value, onChange, placeholder, className }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Prevents setState after unmount
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const supabase = createClient()
    // RLS on quotes table automatically filters by the user's own rows (or all rows for admin).
    const { data } = await supabase
      .from('quotes')
      .select(field)
      .ilike(field, `%${q.trim()}%`)
      .limit(100)

    if (!mountedRef.current) return

    const seen = new Set<string>()
    const results: string[] = []
    for (const row of data ?? []) {
      const val = (row as Record<string, unknown>)[field]
      if (typeof val === 'string' && val.trim() && !seen.has(val)) {
        seen.add(val)
        results.push(val)
        if (results.length >= 10) break
      }
    }
    setSuggestions(results)
    setOpen(results.length > 0)
  }, [field])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    onChange(v)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchSuggestions(v), 200)
  }

  const handleSelect = (s: string) => {
    onChange(s)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        dir="rtl"
      />
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 right-0 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
          dir="rtl"
        >
          {suggestions.map((s, i) => (
            <li key={i} className="border-b border-gray-50 last:border-0">
              <button
                type="button"
                // onPointerDown + preventDefault keeps the input focused on both desktop and mobile,
                // so the dropdown doesn't close before the selection is registered.
                onPointerDown={(e) => {
                  e.preventDefault()
                  handleSelect(s)
                }}
                className="w-full text-right px-3 py-2.5 text-sm text-gray-800 hover:bg-orange-50 active:bg-orange-100 transition-colors"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
