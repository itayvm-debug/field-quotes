'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImageAnnotator } from './ImageAnnotator'
import { CameraCapture } from './CameraCapture'

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
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showCamera, setShowCamera] = useState(false)
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

  // Called when a file is selected (gallery or camera) — opens annotator
  const handleFileSelected = (file: File) => {
    setShowCamera(false)
    setPendingFile(file)
  }

  // Called when annotator saves — upload the result
  const handleAnnotated = async (blob: Blob) => {
    setPendingFile(null)
    setUploading(true)
    setError(null)

    const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
    // Path must start with {userId}/ so storage RLS (foldername[1] = auth.uid()) passes
    const storagePath = `${userId}/${quoteId}/${itemDbId}/${filename}`

    const { error: uploadErr } = await supabase.storage
      .from('quote-images')
      .upload(storagePath, new File([blob], filename, { type: 'image/jpeg' }))

    if (uploadErr) {
      setError('העלאת הקובץ נכשלה. ודא שאתה מחובר ושההצעה שייכת לך.')
      setUploading(false)
      return
    }

    const { error: dbErr } = await supabase.from('item_images').insert({
      item_id: itemDbId,
      storage_path: storagePath,
      include_in_pdf: images.length < 2,
      display_order: images.length + 1,
    })

    if (dbErr) {
      // Remove the orphaned storage file before reporting the error
      await supabase.storage.from('quote-images').remove([storagePath])
      setError('שמירת התמונה נכשלה. ודא שאתה מחובר ושההצעה שייכת לך.')
      setUploading(false)
      return
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
    <>
      {/* Annotation modal */}
      {pendingFile && (
        <ImageAnnotator
          file={pendingFile}
          onSave={handleAnnotated}
          onCancel={() => setPendingFile(null)}
        />
      )}

      {/* Camera modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleFileSelected}
          onCancel={() => setShowCamera(false)}
        />
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">תמונות ({images.length})</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              disabled={uploading}
              className="text-xs text-orange-600 font-medium active:opacity-70 disabled:opacity-40"
            >
              {uploading ? 'מעלה...' : '+ צלם'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-orange-600 font-medium active:opacity-70 disabled:opacity-40"
            >
              גלריה
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) { handleFileSelected(f); e.target.value = '' }
            }}
          />
        </div>

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

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
                {/* PDF toggle */}
                <button
                  type="button"
                  onClick={() => handleTogglePdf(img)}
                  title={img.include_in_pdf ? 'כלול ב-PDF' : 'לא כלול ב-PDF'}
                  className={`absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors ${
                    img.include_in_pdf ? 'bg-orange-500 text-white' : 'bg-black/40 text-white/70'
                  }`}
                >
                  PDF
                </button>
                {/* Delete */}
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
    </>
  )
}
