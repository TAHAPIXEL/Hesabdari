'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { findByBarcode } from '@/lib/catalog'
import { formatQty, formatRial } from '@/lib/money'
import { ToastProvider } from './Toast'
import { formatJalaliLong, todayIso } from '@/lib/jalali'
import { Scanner, ScanIcon } from './Scanner'
import { Button } from './ui'
import type { Product } from '@/lib/types'

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
  const [scan, setScan] = useState(false)
  const [hit, setHit] = useState<Product | null>(null)
  const [unknown, setUnknown] = useState('')

  useEffect(() => {
    const t = localStorage.getItem('theme') === 'dark'
    setDark(t)
    document.documentElement.setAttribute('data-theme', t ? 'dark' : 'light')
    createClient()
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

  async function onCode(code: string) {
    setScan(false)
    const rows = await findByBarcode(code)
    if (rows[0]) setHit(rows[0])
    else setUnknown(code)
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
          <button type="button" className="btn btn-block" style={{ marginBottom: 12 }} onClick={() => setScan(true)}>
            <ScanIcon /> اسکن بارکد
          </button>
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
          <div style={{ padding: 8 }}>
            <button className="btn btn-ghost btn-block" type="button" onClick={toggleTheme}>
              {dark ? 'تم روشن' : 'تم تیره'}
            </button>
          </div>
        </aside>

        <div className="main">{children}</div>

        <nav className="bottom-nav no-print">
          <Link href="/dashboard" className={path.startsWith('/dashboard') ? 'active' : ''}>
            <HomeIcon />
            خانه
          </Link>
          <Link href="/pos" className={path.startsWith('/pos') ? 'active' : ''}>
            <CartIcon />
            فروش
          </Link>
          <button type="button" className="scan-fab" onClick={() => setScan(true)} aria-label="اسکن بارکد">
            <ScanIcon />
          </button>
          <Link href="/products" className={path.startsWith('/products') ? 'active' : ''}>
            <BoxIcon />
            کالا
          </Link>
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
            </div>
          </div>
        ) : null}

        {scan ? <Scanner onClose={() => setScan(false)} onResult={onCode} /> : null}

        {hit ? (
          <div className="sheet no-print" onClick={() => setHit(null)}>
            <div className="sheet-card" onClick={(e) => e.stopPropagation()} style={{ padding: 16 }}>
              <h3>{hit.name}</h3>
              <p className="tiny">
                {hit.barcode ? `بارکد ${hit.barcode}` : ''} {hit.kind === 'goods' ? `موجودی ${formatQty(hit.stock)} ${hit.unit}` : 'خدمات'}
              </p>
              <p className="money" style={{ margin: '8px 0 14px' }}>
                {formatRial(hit.sell_price)}
              </p>
              <Button
                block
                onClick={() => {
                  sessionStorage.setItem('scan-add', hit.id)
                  setHit(null)
                  router.push('/pos')
                }}
              >
                افزودن به فروش
              </Button>
              <Button
                block
                variant="ghost"
                style={{ marginTop: 8 }}
                onClick={() => {
                  sessionStorage.setItem('scan-edit', hit.id)
                  setHit(null)
                  router.push('/products')
                }}
              >
                ویرایش کالا
              </Button>
              <Button
                block
                variant="ghost"
                style={{ marginTop: 8 }}
                onClick={() => {
                  sessionStorage.setItem('scan-stock', hit.id)
                  setHit(null)
                  router.push('/inventory')
                }}
              >
                کاردکس انبار
              </Button>
            </div>
          </div>
        ) : null}

        {unknown ? (
          <div className="sheet no-print" onClick={() => setUnknown('')}>
            <div className="sheet-card" onClick={(e) => e.stopPropagation()} style={{ padding: 16 }}>
              <h3>کالا پیدا نشد</h3>
              <p className="tiny">بارکد {unknown} در فهرست نیست.</p>
              <Button
                block
                onClick={() => {
                  sessionStorage.setItem('scan-new', unknown)
                  setUnknown('')
                  router.push('/products')
                }}
              >
                ثبت کالای جدید با این بارکد
              </Button>
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
