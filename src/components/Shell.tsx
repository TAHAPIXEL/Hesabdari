'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ToastProvider } from './Toast'
import { formatJalaliLong, todayIso } from '@/lib/jalali'

const NAV = [
  { href: '/dashboard', label: 'خانه', icon: HomeIcon },
  { href: '/pos', label: 'فروش', icon: CartIcon },
  { href: '/products', label: 'کالا', icon: BoxIcon },
  { href: '/treasury', label: 'صندوق', icon: WalletIcon },
]

const MORE = [
  { href: '/sales', label: 'فاکتورهای فروش' },
  { href: '/purchases', label: 'خرید کالا' },
  { href: '/parties', label: 'مشتری و تامین‌کننده' },
  { href: '/inventory', label: 'انبار و کاردکس' },
  { href: '/checks', label: 'چک‌ها' },
  { href: '/expenses', label: 'هزینه‌ها' },
  { href: '/reports', label: 'گزارش‌ها' },
  { href: '/journal', label: 'اسناد حسابداری' },
  { href: '/settings', label: 'تنظیمات فروشگاه' },
]

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [more, setMore] = useState(false)
  const [name, setName] = useState('فروشگاه پلاسکو')
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem('theme') === 'dark'
    setDark(t)
    document.documentElement.setAttribute('data-theme', t ? 'dark' : 'light')
    const supabase = createClient()
    supabase
      .from('company_settings')
      .select('name')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name) setName(data.name)
      })
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
  }

  async function logout() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  const moreActive = MORE.some((i) => path.startsWith(i.href))

  return (
    <ToastProvider>
      <div className="shell">
        <aside className="sidebar no-print">
          <div className="side-brand">
            <div className="brand-mark" style={{ margin: 0, width: 40, height: 40, fontSize: 16 }}>
              پ
            </div>
            <div>
              <strong>{name}</strong>
              <span className="tiny">{formatJalaliLong(todayIso())}</span>
            </div>
          </div>
          <nav className="nav-list">
            {NAV.map((i) => (
              <Link key={i.href} href={i.href} className={`nav-item ${path.startsWith(i.href) ? 'active' : ''}`}>
                <i.icon />
                {i.label}
              </Link>
            ))}
            {MORE.map((i) => (
              <Link key={i.href} href={i.href} className={`nav-item ${path.startsWith(i.href) ? 'active' : ''}`}>
                {i.label}
              </Link>
            ))}
          </nav>
          <div style={{ marginTop: 'auto', padding: 8, display: 'grid', gap: 8 }}>
            <button className="btn btn-ghost" type="button" onClick={toggleTheme}>
              {dark ? 'تم روشن' : 'تم تیره'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={logout}>
              خروج
            </button>
          </div>
        </aside>

        <div className="main">{children}</div>

        <nav className="bottom-nav no-print">
          {NAV.map((i) => (
            <Link key={i.href} href={i.href} className={path.startsWith(i.href) ? 'active' : ''}>
              <i.icon />
              {i.label}
            </Link>
          ))}
          <button type="button" className={more || moreActive ? 'active' : ''} onClick={() => setMore(true)}>
            <MoreIcon />
            بیشتر
          </button>
        </nav>

        {more ? (
          <div className="sheet no-print" onClick={() => setMore(false)}>
            <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
              <div className="tiny" style={{ padding: '10px 12px' }}>
                {name}
              </div>
              {MORE.map((i) => (
                <Link key={i.href} href={i.href} onClick={() => setMore(false)}>
                  {i.label}
                </Link>
              ))}
              <button className="sheet-link" type="button" onClick={toggleTheme}>
                {dark ? 'تم روشن' : 'تم تیره'}
              </button>
              <button className="sheet-link" type="button" onClick={logout}>
                خروج از حساب مشترک
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </ToastProvider>
  )
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  )
}
function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 5h2l1.2 9.5a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.6L20 8H8" />
      <circle cx="10" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
    </svg>
  )
}
function BoxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
    </svg>
  )
}
function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M16 12h5v3h-5a1.5 1.5 0 0 1 0-3z" />
    </svg>
  )
}
function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  )
}
