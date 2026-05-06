'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
  senderName: string
}

export function SupportRequestForm({ userId, senderName }: Props) {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) {
      setError('נא למלא נושא והודעה')
      return
    }
    setSubmitting(true)
    setError('')
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbError } = await (supabase as any).from('support_requests').insert({
      user_id: userId,
      sender_name: senderName,
      subject: subject.trim(),
      message: message.trim(),
    })
    if (dbError) {
      setError('שגיאה בשליחה, נסה שוב')
      setSubmitting(false)
      return
    }
    router.push('/dashboard?support=sent')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">נושא</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="במה נוכל לעזור?"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          disabled={submitting}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">הודעה</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="תאר את הבעיה או הבקשה..."
          rows={5}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          disabled={submitting}
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-orange-600 text-white rounded-xl font-semibold text-sm active:bg-orange-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? 'שולח...' : 'שלח פנייה'}
      </button>
    </form>
  )
}
