'use client'

import { useRef, useState, useEffect } from 'react'

interface Props {
  onCapture: (file: File) => void
  onCancel: () => void
}

export function CameraCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('המצלמה אינה נתמכת בדפדפן זה')
      return
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((stream) => {
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch(() => {
        if (mounted) setError('לא ניתן לגשת למצלמה — אנא אפשר הרשאה ונסה שוב')
      })

    return () => {
      mounted = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const stopStream = () => streamRef.current?.getTracks().forEach((t) => t.stop())

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !ready) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      if (!blob) return
      stopStream()
      onCapture(new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.9)
  }

  const handleCancel = () => { stopStream(); onCancel() }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" dir="rtl">
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-center p-8">
            <div>
              <p className="text-white text-base mb-5">{error}</p>
              <button onClick={handleCancel}
                className="bg-orange-600 text-white px-6 py-3 rounded-xl font-medium">
                סגור
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedData={() => setReady(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Viewfinder overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Dimmed corners */}
              <div className="absolute inset-0 bg-black/25" />
              {/* Guide frame */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative" style={{ width: '78%', height: '52%' }}>
                  {/* Clear center (cuts through the dim) */}
                  <div className="absolute inset-0 bg-transparent mix-blend-normal" />
                  {/* Corner brackets */}
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-orange-400 rounded-tr" />
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-orange-400 rounded-tl" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-orange-400 rounded-br" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-orange-400 rounded-bl" />
                  {/* Center dot */}
                  <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400/60" />
                </div>
              </div>
              {/* Hint text */}
              <p className="absolute bottom-24 w-full text-center text-white/70 text-sm">
                כוון את האובייקט למסגרת
              </p>
            </div>
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="flex items-center justify-between px-8 py-5 bg-black">
        <button type="button" onClick={handleCancel}
          className="text-white text-base px-4 py-2 rounded-xl active:bg-white/10">
          ביטול
        </button>
        {/* Shutter */}
        <button
          type="button"
          onClick={handleCapture}
          disabled={!ready || !!error}
          className="w-16 h-16 rounded-full border-4 border-white bg-white/20 active:bg-white/40 disabled:opacity-40 flex items-center justify-center transition-colors"
          aria-label="צלם"
        >
          <div className="w-10 h-10 rounded-full bg-white" />
        </button>
        <div className="w-16" />
      </div>
    </div>
  )
}
