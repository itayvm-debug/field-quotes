'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface PickedClient {
  id: string
  name: string
  contact: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelectClient: (client: PickedClient) => void
  placeholder?: string
  className?: string
}

// Client name field with suggestions from the client book (public.clients).
// Free text is still allowed: a new name creates a client automatically when
// the quote is saved (DB trigger link_quote_client).
export function ClientPicker({ value, onChange, onSelectClient, placeholder, className }: Props) {
  const [suggestions, setSuggestions] = useState<PickedClient[]>([])
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('clients')
      .select('id, name, contact')
      .ilike('name', `%${q.trim()}%`)
      .order('name')
      .limit(8)
    if (!mountedRef.current) return
    const rows = (data ?? []) as PickedClient[]
    setSuggestions(rows)
    setOpen(rows.length > 0)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    onChange(v)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchSuggestions(v), 200)
  }

  const handleSelect = (c: PickedClient) => {
    onSelectClient(c)
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
          {suggestions.map((c) => (
            <li key={c.id} className="border-b border-gray-50 last:border-0">
              <button
                type="button"
                // onPointerDown + preventDefault keeps focus so the list doesn't close first (mobile)
                onPointerDown={(e) => {
                  e.preventDefault()
                  handleSelect(c)
                }}
                className="w-full text-right px-3 py-2 hover:bg-orange-50 active:bg-orange-100 transition-colors"
              >
                <span className="block text-sm text-gray-800">{c.name}</span>
                {c.contact && <span className="block text-xs text-gray-400">{c.contact}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
