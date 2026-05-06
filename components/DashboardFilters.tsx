'use client'

import { useRouter } from 'next/navigation'
import { STATUS_LABELS } from '@/types'

const FILTERS = [
  { value: '', label: 'הכל' },
  { value: 'draft', label: STATUS_LABELS.draft },
  { value: 'sent', label: STATUS_LABELS.sent },
  { value: 'accepted', label: STATUS_LABELS.accepted },
  { value: 'rejected', label: STATUS_LABELS.rejected },
  { value: 'archived', label: STATUS_LABELS.archived },
] as const

interface Props {
  activeFilter: string
}

export function DashboardFilters({ activeFilter }: Props) {
  const router = useRouter()

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => router.push(f.value ? `/dashboard?status=${f.value}` : '/dashboard')}
          className={`whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            activeFilter === f.value
              ? 'bg-orange-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 active:bg-gray-50'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
