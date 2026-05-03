import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuoteForm } from '@/components/QuoteForm'
import type { QuoteItemDraft, QuoteHeaderDraft } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditQuotePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: quote } = await supabase
    .from('quotes')
    .select('*, quote_items(*)')
    .eq('id', id)
    .single()

  if (!quote) notFound()

  const header: QuoteHeaderDraft = {
    client_name: quote.client_name,
    client_address: quote.client_address,
    client_contact: quote.client_contact,
    project_description: quote.project_description,
    quote_date: quote.quote_date,
    valid_until: quote.valid_until ?? '',
    payment_terms: quote.payment_terms,
    exclusions: quote.exclusions,
    vat_percentage: quote.vat_percentage,
  }

  const items: QuoteItemDraft[] = (quote.quote_items ?? [])
    .sort((a: { item_number: number }, b: { item_number: number }) => a.item_number - b.item_number)
    .map((item: {
      id: string
      item_number: number
      description: string
      unit: string
      quantity: number
      unit_price: number
      notes: string
    }) => ({
      tempId: item.id,
      dbId: item.id,
      item_number: item.item_number,
      description: item.description,
      unit: item.unit,
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
      notes: item.notes,
    }))

  return (
    <QuoteForm
      mode="edit"
      quoteId={id}
      userId={user.id}
      initialHeader={header}
      initialItems={items}
    />
  )
}
