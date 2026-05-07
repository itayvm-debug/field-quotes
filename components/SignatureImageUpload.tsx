'use client'

import { useState, useRef } from 'react'

interface Props {
  onSave: (file: File) => void
  disabled?: boolean
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

export function SignatureImageUpload({ onSave, disabled }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('פורמט לא נתמך — יש להעלות PNG, JPG או WebP')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('גודל הקובץ גדול מ-5MB')
      return
    }

    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(file))
    setSelectedFile(file)
  }

  const handleClear = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setSelectedFile(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="bg-white border-2 border-dashed border-orange-200 rounded-xl p-4 flex items-center justify-center" style={{ minHeight: 140 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="תצוגה מקדימה" className="max-h-24 object-contain" />
        </div>
      ) : (
        <label
          className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed transition-colors ${
            disabled
              ? 'border-gray-100 bg-gray-50 pointer-events-none'
              : 'border-gray-200 bg-white active:bg-gray-50 cursor-pointer'
          }`}
          style={{ height: 140 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            className="w-7 h-7 text-gray-300 mb-2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span className="text-sm text-gray-400">בחר תמונת חתימה</span>
          <span className="text-[11px] text-gray-300 mt-0.5">PNG, JPG, WebP · עד 5MB</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled}
          />
        </label>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        {preview ? (
          <>
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 active:bg-gray-50 disabled:opacity-40"
            >
              בחר אחרת
            </button>
            <button
              type="button"
              onClick={() => selectedFile && onSave(selectedFile)}
              disabled={disabled || !selectedFile}
              className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-semibold active:bg-orange-700 disabled:opacity-40"
            >
              {disabled ? 'שומר...' : 'שמור חתימה'}
            </button>
          </>
        ) : (
          <label
            className={`flex-1 py-2.5 text-center border border-orange-300 text-orange-600 rounded-xl text-sm font-semibold cursor-pointer active:bg-orange-50 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
          >
            בחר קובץ
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
              disabled={disabled}
            />
          </label>
        )}
      </div>
    </div>
  )
}
