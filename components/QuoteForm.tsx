'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { QuoteItemCard } from './QuoteItemCard'
import { QuoteSummary } from './QuoteSummary'
import { PAYMENT_TERMS_OPTIONS, type QuoteItemDraft, type QuoteHeaderDraft } from '@/types'

interface Props {
  mode: 'create' | 'edit'
  quoteId?: string
  userId: string
  initialHeader?: Partial<QuoteHeaderDraft>
  initialItems?: QuoteItemDraft[]
}

const TERMS_LIST = PAYMENT_TERMS_OPTIONS as unknown as string[]

const isCustomTerms = (terms: string) => terms !== '' && !TERMS_LIST.includes(terms)

const defaultHeader = (): QuoteHeaderDraft => ({
  client_name: '',
  client_address: '',
  client_contact: '',
  project_description: '',
  quote_date: new Date().toISOString().split('T')[0],
  valid_until: '',
  payment_terms: '',
  exclusions: '',
  vat_percentage: 0,
})

const newItemDraft = (itemNumber: number): QuoteItemDraft => ({
  tempId: crypto.randomUUID(),
  item_number: itemNumber,
  description: '',
  unit: 'יח׳',
  quantity: '1',
  unit_price: '0',
  notes: '',
})

export function QuoteForm({ mode, quoteId, userId, initialHeader, initialItems }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [savedId, setSavedId] = useState<string | undefined>(quoteId)

  const [header, setHeader] = useState<QuoteHeaderDraft>({ ...defaultHeader(), ...initialHeader })
  const [items, setItems] = useState<QuoteItemDraft[]>(initialItems ?? [])
  const [removedDbIds, setRemovedDbIds] = useState<string[]>([])

  const [vatEnabled, setVatEnabled] = useState(
    () => (initialHeader?.vat_percentage ?? 0) > 0
  )
  const [paymentTermsIsCustom, setPaymentTermsIsCustom] = useState(
    () => isCustomTerms(initialHeader?.payment_terms ?? '')
  )

  const setHeaderField = useCallback(
    <K extends keyof QuoteHeaderDraft>(key: K, value: QuoteHeaderDraft[K]) => {
      setHeader((h) => ({ ...h, [key]: value }))
    },
    []
  )

  const handleVatToggle = useCallback(
    (enabled: boolean) => {
      setVatEnabled(enabled)
      setHeaderField('vat_percentage', enabled ? 18 : 0)
    },
    [setHeaderField]
  )

  const handlePaymentTermsSelect = useCallback(
    (value: string) => {
      if (value === '__custom__') {
        setPaymentTermsIsCustom(true)
        setHeaderField('payment_terms', '')
      } else {
        setPaymentTermsIsCustom(false)
        setHeaderField('payment_terms', value)
      }
    },
    [setHeaderField]
  )

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, newItemDraft(prev.length + 1)])
  }, [])

  const updateItem = useCallback((tempId: string, updates: Partial<QuoteItemDraft>) => {
    setItems((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, ...updates } : item))
    )
  }, [])

  const removeItem = useCallback((tempId: string, dbId?: string) => {
    if (dbId) setRemovedDbIds((prev) => [...prev, dbId])
    setItems((prev) => {
      const filtered = prev.filter((item) => item.tempId !== tempId)
      return filtered.map((item, idx) => ({ ...item, item_number: idx + 1 }))
    })
  }, [])

  const saveDraft = async () => {
    setSaving(true)
    setSaveError(null)

    const supabase = createClient()
    const headerPayload = {
      client_name: header.client_name,
      client_address: header.client_address,
      client_contact: header.client_contact,
      project_description: header.project_description,
      quote_date: header.quote_date || new Date().toISOString().split('T')[0],
      valid_until: header.valid_until || null,
      payment_terms: header.payment_terms,
      exclusions: header.exclusions,
      vat_percentage: header.vat_percentage,
      status: 'draft' as const,
    }

    let currentId = savedId

    // ── Create or update quote header ────────────────────────────────────────
    if (!currentId) {
      const { data: created, error } = await supabase
        .from('quotes')
        .insert({ ...headerPayload, user_id: userId })
        .select('id')
        .single()

      if (error || !created) {
        setSaveError(error?.message ?? 'שגיאה ביצירת הצעה')
        setSaving(false)
        return
      }
      currentId = created.id
      setSavedId(currentId)
    } else {
      const { error } = await supabase.from('quotes').update(headerPayload).eq('id', currentId)
      if (error) {
        setSaveError(error.message)
        setSaving(false)
        return
      }
    }

    // ── Delete removed items ──────────────────────────────────────────────────
    if (removedDbIds.length > 0) {
      await supabase.from('quote_items').delete().in('id', removedDbIds)
      setRemovedDbIds([])
    }

    // ── Batch INSERT new items ────────────────────────────────────────────────
    const newItems = items.filter((i) => !i.dbId)
    if (newItems.length > 0) {
      const { data: inserted, error } = await supabase
        .from('quote_items')
        .insert(
          newItems.map((i) => ({
            quote_id: currentId!,
            item_number: i.item_number,
            description: i.description,
            unit: i.unit || 'יח׳',
            quantity: parseFloat(i.quantity) || 0,
            unit_price: parseFloat(i.unit_price) || 0,
            notes: i.notes,
          }))
        )
        .select('id')

      if (error) {
        setSaveError(error.message)
        setSaving(false)
        return
      }

      if (inserted) {
        let idx = 0
        setItems((prev) =>
          prev.map((item) => {
            if (!item.dbId) {
              const dbId = inserted[idx++]?.id
              return dbId ? { ...item, dbId } : item
            }
            return item
          })
        )
      }
    }

    // ── UPDATE existing items ─────────────────────────────────────────────────
    const existingItems = items.filter((i) => i.dbId)
    for (const item of existingItems) {
      await supabase
        .from('quote_items')
        .update({
          item_number: item.item_number,
          description: item.description,
          unit: item.unit || 'יח׳',
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          notes: item.notes,
        })
        .eq('id', item.dbId!)
    }

    setSaving(false)
    setSaveSuccess(true)
    setTimeout(() => router.push('/dashboard'), 1200)
  }

  const paymentTermsSelectValue = paymentTermsIsCustom ? '__custom__' : header.payment_terms

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-500 text-sm font-medium px-1 py-1"
            >
              ← חזור
            </button>
            {mode === 'edit' && savedId && (
              <a
                href={`/api/quotes/${savedId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 text-xs font-medium px-2 py-1.5 border border-gray-200 rounded-lg active:bg-gray-50"
              >
                PDF
              </a>
            )}
          </div>
          <h1 className="font-bold text-gray-900">
            {mode === 'create' ? 'הצעה חדשה' : 'עריכת הצעה'}
          </h1>
          <button
            onClick={saveDraft}
            disabled={saving || saveSuccess}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 active:bg-blue-700 transition-colors"
          >
            {saving ? 'שומר...' : saveSuccess ? '✓ נשמר' : 'שמור'}
          </button>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4 mt-4">
        {/* Success banner */}
        {saveSuccess && (
          <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl px-4 py-3 text-sm font-medium text-center">
            נשמר בהצלחה! חוזר לדשבורד...
          </div>
        )}

        {/* Error */}
        {saveError && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
            {saveError}
          </div>
        )}

        {/* Client details */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-700">פרטי לקוח</h2>

          <Field label="שם לקוח">
            <input
              type="text"
              value={header.client_name}
              onChange={(e) => setHeaderField('client_name', e.target.value)}
              className={inputCls}
              placeholder="שם הלקוח"
            />
          </Field>

          <Field label="כתובת / פרויקט">
            <input
              type="text"
              value={header.client_address}
              onChange={(e) => setHeaderField('client_address', e.target.value)}
              className={inputCls}
              placeholder="כתובת האתר"
            />
          </Field>

          <Field label="איש קשר">
            <input
              type="text"
              value={header.client_contact}
              onChange={(e) => setHeaderField('client_contact', e.target.value)}
              className={inputCls}
              placeholder="שם איש קשר וטלפון"
            />
          </Field>

          <Field label="תיאור כללי">
            <textarea
              value={header.project_description}
              onChange={(e) => setHeaderField('project_description', e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="תיאור קצר של הפרויקט..."
            />
          </Field>
        </section>

        {/* Dates */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-700">תאריכים</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך הצעה">
              <input
                type="date"
                value={header.quote_date}
                onChange={(e) => setHeaderField('quote_date', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="תוקף הצעה">
              <input
                type="date"
                value={header.valid_until}
                onChange={(e) => setHeaderField('valid_until', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </section>

        {/* Terms */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-700">תנאים</h2>

          <Field label="תנאי תשלום">
            <select
              value={paymentTermsSelectValue}
              onChange={(e) => handlePaymentTermsSelect(e.target.value)}
              className={inputCls}
            >
              <option value="">בחר תנאי תשלום...</option>
              {PAYMENT_TERMS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value="__custom__">אחר...</option>
            </select>
            {paymentTermsIsCustom && (
              <input
                type="text"
                value={header.payment_terms}
                onChange={(e) => setHeaderField('payment_terms', e.target.value)}
                className={`${inputCls} mt-2`}
                placeholder="הזן תנאי תשלום..."
              />
            )}
          </Field>

          <Field label="החרגות / הערות">
            <textarea
              value={header.exclusions}
              onChange={(e) => setHeaderField('exclusions', e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="מה לא כלול בהצעה זו..."
            />
          </Field>
        </section>

        {/* Items */}
        <section>
          <h2 className="font-semibold text-gray-700 mb-3">
            סעיפים ({items.length})
          </h2>
          <div className="space-y-3">
            {items.map((item) => (
              <QuoteItemCard
                key={item.tempId}
                item={item}
                onChange={(updates) => updateItem(item.tempId, updates)}
                onRemove={() => removeItem(item.tempId, item.dbId)}
                quoteId={savedId}
                userId={userId}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-3 w-full py-4 border-2 border-dashed border-blue-200 rounded-2xl text-blue-500 font-semibold text-base active:bg-blue-50 transition-colors"
          >
            + הוסף סעיף
          </button>
        </section>

        {/* Summary */}
        <QuoteSummary
          items={items}
          vatEnabled={vatEnabled}
          onVatToggle={handleVatToggle}
        />

        {/* Bottom save button */}
        <button
          onClick={saveDraft}
          disabled={saving || saveSuccess}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl text-lg font-bold disabled:opacity-50 active:bg-blue-700 transition-colors"
        >
          {saving ? 'שומר...' : saveSuccess ? '✓ נשמר בהצלחה!' : 'שמור טיוטה'}
        </button>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
