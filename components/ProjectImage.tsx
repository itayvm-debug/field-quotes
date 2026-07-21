'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CropModal } from './CropModal'
import { ImageAnnotator } from './ImageAnnotator'
import { CameraCapture } from './CameraCapture'

interface Props {
  quoteId: string | undefined
  userId: string
  imagePath: string | null
  imageCaption: string
  imageFit: 'cover' | 'contain'
  onChange: (updates: Partial<{ path: string | null; caption: string; fit: 'cover' | 'contain' }>) => void
  onAutoSave: () => Promise<string | null>
}

// 16:9 aspect ratio for project images
const ASPECT = 16 / 9

export function ProjectImage({
  quoteId,
  userId,
  imagePath,
  imageCaption,
  imageFit,
  onChange,
  onAutoSave,
}: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Stage 1: raw file from gallery/camera → enters CropModal
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  // Stage 2: cropped file from CropModal → enters ImageAnnotator
  const [croppedFile, setCroppedFile] = useState<File | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!imagePath) { setSignedUrl(null); return }
    supabase.storage.from('quote-images').createSignedUrl(imagePath, 3600)
      .then(({ data }) => setSignedUrl(data?.signedUrl ?? null))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagePath])

  const handleFileSelected = (file: File) => {
    setShowCamera(false)
    setPendingFile(file)
  }

  // CropModal confirmed → save fit choice, create File for ImageAnnotator
  const handleCropDone = (blob: Blob, fit: 'cover' | 'contain') => {
    setPendingFile(null)
    onChange({ fit })
    setCroppedFile(new File([blob], 'cropped.jpg', { type: 'image/jpeg' }))
  }

  // ImageAnnotator saved → upload the final annotated image
  const handleAnnotated = async (blob: Blob) => {
    setCroppedFile(null)
    setUploading(true)
    setError(null)

    const effectiveQuoteId = quoteId ?? await onAutoSave()
    if (!effectiveQuoteId) {
      setError('שגיאה בשמירת ההצעה')
      setUploading(false)
      return
    }

    // Remove old image from storage if replacing
    if (imagePath) {
      await supabase.storage.from('quote-images').remove([imagePath])
    }

    const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
    const storagePath = `${userId}/${effectiveQuoteId}/project-image/${filename}`

    const { error: uploadErr } = await supabase.storage
      .from('quote-images')
      .upload(storagePath, new File([blob], filename, { type: 'image/jpeg' }))

    if (uploadErr) {
      setError('העלאת התמונה נכשלה. ודא שאתה מחובר ושההצעה שייכת לך.')
      setUploading(false)
      return
    }

    const { error: dbErr } = await supabase
      .from('quotes')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ project_image_path: storagePath } as any)
      .eq('id', effectiveQuoteId)

    if (dbErr) {
      await supabase.storage.from('quote-images').remove([storagePath])
      setError('שמירת התמונה נכשלה.')
      setUploading(false)
      return
    }

    onChange({ path: storagePath })
    setUploading(false)
  }

  const handleDelete = async () => {
    if (!imagePath || !quoteId) return
    await supabase.storage.from('quote-images').remove([imagePath])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('quotes').update({ project_image_path: null } as any).eq('id', quoteId)
    onChange({ path: null })
    setSignedUrl(null)
  }

  return (
    <>
      {/* Stage 1: raw file → CropModal */}
      {pendingFile && (
        <CropModal
          file={pendingFile}
          aspectRatio={ASPECT}
          defaultFit={imageFit}
          onConfirm={handleCropDone}
          onCancel={() => setPendingFile(null)}
        />
      )}

      {/* Stage 2: cropped file → ImageAnnotator */}
      {croppedFile && (
        <ImageAnnotator
          file={croppedFile}
          onSave={handleAnnotated}
          onCancel={() => setCroppedFile(null)}
        />
      )}

      {showCamera && (
        <CameraCapture
          onCapture={handleFileSelected}
          onCancel={() => setShowCamera(false)}
        />
      )}

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

      <div className="space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">תמונת פרויקט</span>
          {!imagePath && (
            <div className="flex gap-3">
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
          )}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}
        {uploading && <p className="text-xs text-orange-500">מעלה תמונה...</p>}

        {/* Image preview */}
        {imagePath && (
          <>
            <div className="relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50"
              style={{ aspectRatio: '16/9' }}>
              {signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signedUrl}
                  alt={imageCaption || 'תמונת פרויקט'}
                  className="w-full h-full"
                  style={{ objectFit: imageFit }}
                />
              ) : (
                <div className="w-full h-full bg-gray-100 animate-pulse" />
              )}

              {/* Overlay controls */}
              <div className="absolute top-2 inset-x-2 flex justify-between items-start">
                {/* Fit toggle */}
                <button
                  type="button"
                  onClick={() => onChange({ fit: imageFit === 'cover' ? 'contain' : 'cover' })}
                  className="text-xs bg-black/50 text-white px-2 py-1 rounded-lg backdrop-blur-sm"
                >
                  {imageFit === 'cover' ? 'מילוי' : 'התאמה'}
                </button>

                {/* Replace / delete */}
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs bg-black/50 text-white px-2 py-1 rounded-lg backdrop-blur-sm"
                  >
                    החלף
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="text-xs bg-red-500/80 text-white px-2 py-1 rounded-lg backdrop-blur-sm"
                  >
                    מחק
                  </button>
                </div>
              </div>
            </div>

            {/* Caption */}
            <input
              type="text"
              value={imageCaption}
              onChange={(e) => onChange({ caption: e.target.value })}
              placeholder="כותרת אופציונלית לתמונה (תופיע ב-PDF)..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              dir="rtl"
            />
          </>
        )}
      </div>
    </>
  )
}
