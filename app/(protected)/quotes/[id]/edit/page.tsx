import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuoteForm } from '@/components/QuoteForm'
import { parsePriceAdjustments } from '@/lib/priceAdjustments'
import type { QuoteItemDraft, QuoteHeaderDraft } from '@/types'

// Shift quote_date to today and move valid_until by the same number of days.
// Runs once per page load (server component) — never during client re-renders.
function shiftDatesIfNeeded(
  quoteDate: string | null,
  validUntil: string | null,
): { quote_date: string; valid_until: string } {
  const today = new Date().toISOString().split('T')[0]
  const origDate = quoteDate ?? today

  if (origDate === today) {
    return { quote_date: origDate, valid_until: validUntil ?? '' }
  }

  // Preserve original validity duration; fall back to 30 days if invalid/missing.
  let newValidUntil: string
  if (validUntil && validUntil > origDate) {
    const days = Math.round(
      (new Date(validUntil).getTime() - new Date(origDate).getTime()) / 86_400_000
    )
    const d = new Date(today)
    d.setDate(d.getDate() + days)
    newValidUntil = d.toISOString().split('T')[0]
  } else {
    const d = new Date(today)
    d.setDate(d.getDate() + 30)
    newValidUntil = d.toISOString().split('T')[0]
  }

  return { quote_date: today, valid_until: newValidUntil }
}

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

  const [{ data: quote }, { data: settings }] = await Promise.all([
    supabase.from('quotes').select('*, quote_items(*)').eq('id', id).single(),
    supabase.from('company_settings').select('logo_storage_path').single(),
  ])

  if (!quote) notFound()

  let logoUrl: string | null = null
  if (settings?.logo_storage_path) {
    const { data: logoData } = await supabase.storage
      .from('company-assets').createSignedUrl(settings.logo_storage_path, 3600)
    logoUrl = logoData?.signedUrl ?? null
  }

  const { quote_date, valid_until } = shiftDatesIfNeeded(quote.quote_date, quote.valid_until)

  const header: QuoteHeaderDraft = {
    client_name: quote.client_name,
    client_address: quote.client_address,
    client_contact: quote.client_contact,
    project_description: quote.project_description,
    quote_date,
    valid_until,
    payment_terms: quote.payment_terms,
    exclusions: quote.exclusions,
    vat_percentage: quote.vat_percentage,
    price_adjustments: parsePriceAdjustments((quote as any).price_adjustments),
    project_image_path: (quote as any).project_image_path ?? null,
    project_image_caption: (quote as any).project_image_caption ?? '',
    project_image_fit: ((quote as any).project_image_fit ?? 'cover') as 'cover' | 'contain',
    quote_pricing_type: (quote as any).quote_pricing_type ?? null,
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
      is_optional?: boolean
    }) => ({
      tempId: item.id,
      dbId: item.id,
      item_number: item.item_number,
      description: item.description,
      unit: item.unit,
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
      notes: item.notes,
      is_optional: item.is_optional,
    }))

  return (
    <QuoteForm
      mode="edit"
      quoteId={id}
      userId={user.id}
      logoUrl={logoUrl}
      initialHeader={header}
      initialItems={items}
    />
  )
}
