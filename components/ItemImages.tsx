'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ImageRow {
  id: string
  storage_path: string
  include_in_pdf: boolean
  display_order: number
  caption: string
  signedUrl: string
}

interface Props {
  itemDbId: string
  quoteId: string
  userId: string
}

export function ItemImages({ itemDbId, quoteId, userId }: Props) {
  const [images, setImages] = useState<ImageRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadImages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemDbId])

  const loadImages = async () => {
    const { data, error: fetchErr } = await supabase
      .from('item_images')
      .select('id, storage_path, include_in_pdf, display_order, caption')
      .eq('item_id', itemDbId)
      .order('display_order')

    if (fetchErr || !data) return

    const withUrls = await Promise.all(
      data.map(async (img) => {
        const { data: urlData } = await supabase.storage
          .from('quote-images')
          .createSignedUrl(img.storage_path, 3600)
        return { ...img, signedUrl: urlData?.signedUrl ?? '' }
      })
    )
    setImages(withUrls)
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const storagePath = `quote-images/${userId}/${quoteId}/${itemDbId}/${filename}`

      const { error: uploadErr } = await supabase.storage
        .from('quote-images')
        .upload(storagePath, file)

      if (uploadErr) {
        setError(`שגיאת העלאה: ${uploadErr.message}`)
        continue
      }

      const currentCount = images.length
      await supabase.from('item_images').insert({
        item_id: itemDbId,
        storage_path: storagePath,
        include_in_pdf: currentCount < 2,
        display_order: currentCount + 1,
      })
    }

    await loadImages()
    setUploading(false)
  }

  const handleDelete = async (img: ImageRow) => {
    await supabase.storage.from('quote-images').remove([img.storage_path])
    await supabase.from('item_images').delete().eq('id', img.id)
    setImages((prev) => prev.filter((i) => i.id !== img.id))
  }

  const handleTogglePdf = async (img: ImageRow) => {
    const next = !img.include_in_pdf
    await supabase.from('item_images').update({ include_in_pdf: next }).eq('id', img.id)
    setImages((prev) => prev.map((i) => (i.id === img.id ? { ...i, include_in_pdf: next } : i)))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">תמונות ({images.length})</span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-blue-600 font-medium active:opacity-70 disabled:opacity-40"
        >
          {uploading ? 'מעלה...' : '+ הוסף תמונה'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <div key={img.id} className="relative group">
              {img.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.signedUrl}
                  alt=""
                  className="w-full aspect-square object-cover rounded-xl border border-gray-100"
                />
              ) : (
                <div className="w-full aspect-square rounded-xl bg-gray-100" />
              )}

              {/* PDF toggle badge */}
              <button
                type="button"
                onClick={() => handleTogglePdf(img)}
                title={img.include_in_pdf ? 'כלול ב-PDF — לחץ להסרה' : 'לא כלול ב-PDF — לחץ להוספה'}
                className={`absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors ${
                  img.include_in_pdf
                    ? 'bg-blue-500 text-white'
                    : 'bg-black/40 text-white/70'
                }`}
              >
                PDF
              </button>

              {/* Delete button */}
              <button
                type="button"
                onClick={() => handleDelete(img)}
                className="absolute top-1 left-1 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity"
                aria-label="מחק תמונה"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
