import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { QuotePDF } from '@/lib/pdf/QuotePDF'
import type { PdfItem, PdfItemImage, PdfCreator } from '@/lib/pdf/QuotePDF'
import { buildQuotePdfFilename } from '@/lib/share/shareQuotePdf'
import { parsePriceAdjustments } from '@/lib/priceAdjustments'

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

  // Project image signed URL
  let projectImageUrl: string | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectImagePath = (quote as any).project_image_path as string | null
  if (projectImagePath) {
    const { data: piData } = await supabase.storage
      .from('quote-images')
      .createSignedUrl(projectImagePath, 3600)
    projectImageUrl = piData?.signedUrl ?? null
  }

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
        is_optional: item.is_optional ?? false,
        images,
      }
    })
  )

  // Diagnostic logging — remove once image pipeline is verified stable
  console.log(`[pdf-debug] quoteId=${id} items=${items.length}`)
  for (const item of items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawItem = rawItems.find((r: any) => r.item_number === item.item_number)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbCount: number = (rawItem as any)?.item_images?.length ?? 0
    const includedCount = item.images.filter(img => img.include_in_pdf).length
    const signedCount   = item.images.filter(img => img.include_in_pdf && img.signedUrl).length
    const skippedUrls   = item.images.filter(img => img.include_in_pdf && !img.signedUrl).length
    console.log(
      `[pdf-debug]  item ${item.item_number}: db=${dbCount}` +
      ` include_in_pdf=${includedCount} signed_url=${signedCount}` +
      (skippedUrls ? ` WARN_url_missing=${skippedUrls}` : '')
    )
  }

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        price_adjustments: parsePriceAdjustments((quote as any).price_adjustments),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quote_pricing_type: (quote as any).quote_pricing_type ?? null,
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
      projectImageUrl,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      projectImageCaption: ((quote as any).project_image_caption ?? '') as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      projectImageFit: (((quote as any).project_image_fit ?? 'cover') as 'cover' | 'contain'),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(pdfElement as any)

    const disposition = `inline; filename="${buildQuotePdfFilename(quote.quote_number)}"`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = new Blob([buffer as any], { type: 'application/pdf' })
    return new Response(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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
