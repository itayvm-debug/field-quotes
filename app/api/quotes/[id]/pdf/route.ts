import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { QuotePDF } from '@/lib/pdf/QuotePDF'
import type { PdfItem, PdfItemImage, PdfCreator } from '@/lib/pdf/QuotePDF'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch quote + items + item images
  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .select('*, quote_items(*, item_images(*))')
    .eq('id', id)
    .single()

  if (quoteErr || !quote) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch company settings
  const { data: company } = await supabase
    .from('company_settings')
    .select('company_name, company_id_number, address, phone, email, footer_text, logo_storage_path')
    .single()

  // Company logo signed URL
  let logoUrl: string | null = null
  if (company?.logo_storage_path) {
    const { data: urlData } = await supabase.storage
      .from('company-assets')
      .createSignedUrl(company.logo_storage_path, 3600)
    logoUrl = urlData?.signedUrl ?? null
  }

  // Creator profile (for signature section)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creatorUserId: string | null = (quote as any).user_id ?? null
  let creator: PdfCreator | null = null
  if (creatorUserId) {
    const { data: creatorRaw } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', creatorUserId)
      .single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cp = creatorRaw as any
    if (cp) {
      let signatureUrl: string | null = null
      if (cp.signature_storage_path) {
        const { data: sigData } = await supabase.storage
          .from('user-signatures')
          .createSignedUrl(cp.signature_storage_path, 3600)
        signatureUrl = sigData?.signedUrl ?? null
      }
      creator = {
        full_name: cp.full_name ?? '',
        job_title: cp.job_title ?? '',
        signature_url: signatureUrl,
      }
    }
  }

  // Check if quote has any approvals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: approvalCount } = await (supabase as any)
    .from('quote_approvals')
    .select('id', { count: 'exact', head: true })
    .eq('quote_id', id)
  const hasApproval = (approvalCount ?? 0) > 0

  // Build items with signed image URLs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems: any[] = (quote.quote_items ?? []).sort(
    (a: { item_number: number }, b: { item_number: number }) => a.item_number - b.item_number
  )

  const items: PdfItem[] = await Promise.all(
    rawItems.map(async (item) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawImages: any[] = item.item_images ?? []
      const images: PdfItemImage[] = await Promise.all(
        rawImages.map(async (img) => {
          let signedUrl = ''
          if (img.include_in_pdf) {
            const { data: urlData } = await supabase.storage
              .from('quote-images')
              .createSignedUrl(img.storage_path, 3600)
            signedUrl = urlData?.signedUrl ?? ''
          }
          return {
            storage_path: img.storage_path,
            signedUrl,
            include_in_pdf: img.include_in_pdf,
          }
        })
      )

      return {
        item_number: item.item_number,
        description: item.description,
        unit: item.unit,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        notes: item.notes,
        images,
      }
    })
  )

  try {
    const pdfElement = React.createElement(QuotePDF, {
      quote: {
        quote_number: quote.quote_number,
        status: quote.status,
        client_name: quote.client_name,
        client_address: quote.client_address,
        client_contact: quote.client_contact,
        project_description: quote.project_description,
        quote_date: quote.quote_date,
        valid_until: quote.valid_until,
        payment_terms: quote.payment_terms,
        exclusions: quote.exclusions,
        vat_percentage: parseFloat(String(quote.vat_percentage)),
        has_approval: hasApproval,
      },
      items,
      company: {
        company_name: company?.company_name ?? '',
        company_id_number: company?.company_id_number ?? '',
        address: company?.address ?? '',
        phone: company?.phone ?? '',
        email: company?.email ?? '',
        footer_text: company?.footer_text ?? '',
      },
      logoUrl,
      creator,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(pdfElement as any)

    const filename = quote.quote_number
      ? `quote-${quote.quote_number}.pdf`
      : `quote-${id.slice(0, 8)}.pdf`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = new Blob([buffer as any], { type: 'application/pdf' })
    return new Response(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('PDF render error:', message, stack)
    return NextResponse.json(
      { error: 'PDF generation failed', details: message, stack },
      { status: 500 }
    )
  }
}
