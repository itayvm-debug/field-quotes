'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/calculations'

export interface ClientRow {
  id: string
  name: string
  contact: string
  quoteCount: number
  acceptedCount: number
  openCount: number
  total: number
  acceptedTotal: number
  lastDate: string | null
}

type SortKey = 'recent' | 'name' | 'count'

export function ClientsList({ rows }: { rows: ClientRow[] }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = needle
      ? rows.filter((r) => r.name.toLowerCase().includes(needle) || r.contact.toLowerCase().includes(needle))
      : rows
    const sorted = [...filtered]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'he'))
    else if (sort === 'count') sorted.sort((a, b) => b.quoteCount - a.quoteCount)
    else sorted.sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? ''))
    return sorted
  }, [rows, q, sort])

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לקוח או איש קשר..."
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="border border-gray-200 rounded-xl px-2 py-2.5 text-sm bg-white"
          aria-label="מיון"
        >
          <option value="recent">אחרונים</option>
          <option value="count">הכי הרבה הצעות</option>
          <option value="name">א-ב</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="text-center text-gray-400 py-12">לא נמצאו לקוחות</p>
      ) : (
        shown.map((r) => (
          <Link
            key={r.id}
            href={`/clients/${r.id}`}
            className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 active:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{r.name}</p>
                {r.contact && <p className="text-xs text-gray-400 truncate mt-0.5">{r.contact}</p>}
              </div>
              <div className="text-left shrink-0">
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(r.total)}</p>
                <p className="text-[11px] text-gray-400">סה״כ הצעות</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
              <span>{r.quoteCount} הצעות</span>
              {r.openCount > 0 && <span className="text-blue-600">{r.openCount} פתוחות</span>}
              {r.acceptedCount > 0 && <span className="text-green-600">{r.acceptedCount} אושרו · {formatCurrency(r.acceptedTotal)}</span>}
              {r.lastDate && <span>אחרונה: {formatDate(r.lastDate)}</span>}
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
