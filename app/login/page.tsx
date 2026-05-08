'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { loginIdentifierToEmail } from '@/lib/auth/username'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isInactive = searchParams.get('inactive') === '1'

  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const email = loginIdentifierToEmail(login)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(
        authError.message.includes('Invalid login credentials')
          ? 'אימייל או סיסמה שגויים'
          : authError.message
      )
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen relative" dir="rtl">

      {/* Desktop: full-screen hero image */}
      <div className="absolute inset-0 hidden lg:block">
        <Image
          src="/login-hero.png"
          alt=""
          fill
          className="object-cover object-center"
          priority
          quality={85}
          sizes="100vw"
        />
        {/* White wash — dims image to keep card readable while image stays as atmosphere */}
        <div className="absolute inset-0 bg-white/55" />
      </div>

      {/* Mobile: plain background */}
      <div className="lg:hidden absolute inset-0 bg-gray-50" />

      {/* Content — truly centered on screen */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile: company logo above title */}
          <div className="lg:hidden flex justify-center mb-5">
            <Image
              src="/company-logo.png"
              alt="נתן ולדמן ובניו בע״מ"
              width={80}
              height={80}
              className="object-contain"
            />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">הצעות מחיר</h1>
            <p className="text-gray-500 mt-2 text-sm">כניסה למערכת</p>
          </div>

          {isInactive && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm text-center mb-4 font-medium">
              המשתמש אינו פעיל. פנה למנהל המערכת.
            </div>
          )}

          {/* Card — frosted glass on desktop, clean white on mobile */}
          <div className="bg-white lg:bg-white/88 lg:backdrop-blur-sm rounded-2xl shadow-sm lg:shadow-xl border border-gray-100 lg:border-white/50 p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  שם משתמש / אימייל
                </label>
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="שם משתמש או אימייל"
                  required
                  autoComplete="username"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  סיסמה
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-600 text-white rounded-xl py-4 text-lg font-semibold disabled:opacity-60 active:bg-orange-700 transition-colors mt-2"
              >
                {loading ? 'נכנס...' : 'כניסה'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 leading-relaxed mt-6 px-2">
            כל הזכויות במערכת, במסמכים, בעיצוב ובפונקציונליות שמורות לחברת נתן ולדמן ובניו בע״מ.
            אין להעתיק, לשכפל, להפיץ או לעשות שימוש במערכת או בחלקים ממנה ללא אישור מראש ובכתב.
          </p>
        </div>
      </div>

    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
