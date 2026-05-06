import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function logout() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function AppHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('company_settings').select('company_name, logo_storage_path').single(),
  ])

  const isAdmin = profile?.role === 'admin'

  let logoUrl: string | null = null
  if (settings?.logo_storage_path) {
    const { data } = await supabase.storage
      .from('company-assets')
      .createSignedUrl(settings.logo_storage_path, 3600)
    logoUrl = data?.signedUrl ?? null
  }

  let openRequestCount = 0
  if (isAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from('support_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
    openRequestCount = count ?? 0
  }

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3" dir="rtl">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-7 w-auto object-contain rounded" />
          ) : null}
          <span className="text-sm font-semibold text-gray-800">הצעות מחיר</span>
        </Link>

        <div className="flex items-center gap-1">
          {isAdmin ? (
            <>
              <Link href="/admin/requests" className="relative text-gray-400 p-2.5" title="פניות משתמשים">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                {openRequestCount > 0 && (
                  <span className="absolute top-1 left-1 text-[10px] font-bold bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {openRequestCount > 9 ? '9+' : openRequestCount}
                  </span>
                )}
              </Link>
              <Link href="/admin/users" className="text-gray-400 p-2.5" title="ניהול משתמשים">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </Link>
              <Link href="/admin/analytics" className="text-gray-400 p-2.5" title="ניתוח נתונים">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </Link>
              <Link href="/settings/company" className="text-gray-400 p-2.5" title="הגדרות חברה">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </Link>
            </>
          ) : (
            <Link href="/support/new" className="text-gray-400 p-2.5" title="פנייה לאדמין">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </Link>
          )}
          <Link href="/settings/profile" className="text-gray-400 p-2.5" title="פרופיל אישי">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>
          <Link
            href="/quotes/new"
            className="bg-orange-600 text-white rounded-xl px-3 py-2 font-semibold text-sm active:bg-orange-700 transition-colors"
          >
            הצעה חדשה +
          </Link>
          <form action={logout}>
            <button type="submit" className="text-gray-400 text-sm p-2.5">יציאה</button>
          </form>
        </div>
      </div>
    </header>
  )
}
