'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'

interface Props {
  isAdmin: boolean
  logoUrl: string | null
  openRequestCount: number
  pendingPaymentCount: number
}

function MenuLink({
  href,
  children,
  onClick,
  badge,
}: {
  href: string
  children: React.ReactNode
  onClick: () => void
  badge?: number
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center justify-between px-5 py-3.5 text-gray-800 font-medium text-base active:bg-gray-50"
    >
      <span>{children}</span>
      {badge != null && badge > 0 && (
        <span className="text-xs font-bold bg-orange-500 text-white rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  )
}

export function AppHeaderClient({ isAdmin, logoUrl, openRequestCount, pendingPaymentCount }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-100" dir="rtl">

      {/* ─── Desktop (≥ 768px) ─── */}
      <div className="hidden md:flex items-center justify-between max-w-2xl mx-auto px-4 py-3">
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
              <Link href="/admin/payment-requests" className="relative text-gray-400 p-2.5" title="בקשות תשלום">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {pendingPaymentCount > 0 && (
                  <span className="absolute top-1 left-1 text-[10px] font-bold bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {pendingPaymentCount > 9 ? '9+' : pendingPaymentCount}
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
            <Link href="/support/new" className="text-gray-400 p-2.5" title="פנייה לתמיכה">
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

      {/* ─── Mobile (< 768px) ─── */}
      <div className="flex md:hidden items-center justify-between px-3 py-2.5">
        {/* Right: logo + title */}
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0 shrink">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-7 w-auto object-contain rounded shrink-0" />
          ) : null}
          <span className="text-sm font-semibold text-gray-800 truncate">הצעות מחיר</span>
        </Link>

        {/* Left: new quote button + menu toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/quotes/new"
            className="bg-orange-600 text-white rounded-xl px-3 py-2 text-sm font-semibold active:bg-orange-700 transition-colors whitespace-nowrap"
          >
            הצעה חדשה +
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="text-gray-600 p-2 rounded-lg active:bg-gray-100 transition-colors"
            aria-label="תפריט"
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ─── Mobile menu dropdown ─── */}
      {menuOpen && (
        <>
          {/* Tap-outside overlay */}
          <div
            className="fixed inset-0 z-10"
            onClick={closeMenu}
            aria-hidden="true"
          />
          {/* Menu panel */}
          <nav className="absolute top-full right-0 left-0 z-20 bg-white shadow-lg border-t border-gray-100 md:hidden">
            <div className="divide-y divide-gray-100">
              <MenuLink href="/dashboard" onClick={closeMenu}>דשבורד</MenuLink>
              <MenuLink href="/settings/profile" onClick={closeMenu}>פרופיל אישי</MenuLink>
              {isAdmin ? (
                <>
                  <MenuLink href="/admin/requests" onClick={closeMenu} badge={openRequestCount}>
                    פניות משתמשים
                  </MenuLink>
                  <MenuLink href="/admin/payment-requests" onClick={closeMenu} badge={pendingPaymentCount}>
                    בקשות תשלום
                  </MenuLink>
                  <MenuLink href="/admin/analytics" onClick={closeMenu}>ניתוח נתונים</MenuLink>
                  <MenuLink href="/admin/users" onClick={closeMenu}>ניהול משתמשים</MenuLink>
                  <MenuLink href="/settings/company" onClick={closeMenu}>הגדרות חברה</MenuLink>
                </>
              ) : (
                <MenuLink href="/support/new" onClick={closeMenu}>פנייה לתמיכה</MenuLink>
              )}
            </div>
            <div className="border-t border-gray-100">
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full text-right px-5 py-3.5 text-red-500 font-medium text-base active:bg-red-50"
                >
                  יציאה
                </button>
              </form>
            </div>
          </nav>
        </>
      )}
    </header>
  )
}
