import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: approvals, error } = await (supabase as any)
    .from('quote_approvals')
    .select('*, uploader:uploaded_by(full_name)')
    .eq('quote_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const withUrls = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (approvals ?? []).map(async (approval: any) => {
      const { data: urlData } = await supabase.storage
        .from('quote-approvals')
        .createSignedUrl(approval.storage_path, 3600)
      return { ...approval, signedUrl: urlData?.signedUrl ?? null }
    })
  )

  return NextResponse.json({ approvals: withUrls })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: quoteId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote } = await (supabase as any)
    .from('quotes')
    .select('user_id')
    .eq('id', quoteId)
    .single()

  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const note = (formData.get('note') as string) ?? ''

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'bin'
  const filename = `${crypto.randomUUID()}.${ext}`
  const storagePath = `${quote.user_id}/${quoteId}/${filename}`

  const fileBuffer = await file.arrayBuffer()
  const adminClient = createAdminClient()

  const { error: uploadErr } = await adminClient.storage
    .from('quote-approvals')
    .upload(storagePath, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: approval, error: dbErr } = await (supabase as any)
    .from('quote_approvals')
    .insert({
      quote_id: quoteId,
      uploaded_by: user.id,
      storage_path: storagePath,
      file_name: file.name,
      file_type: file.type || null,
      note: note.trim(),
    })
    .select()
    .single()

  if (dbErr) {
    await adminClient.storage.from('quote-approvals').remove([storagePath])
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({ approval })
}
