'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatJalaliLong, jalaliToIso, todayIso, todayJalali } from '@/lib/jalali'
import type { DashboardStats, Invoice, Product } from '@/lib/types'
import { Money, Spinner } from '@/components/ui'

const EMPTY: DashboardStats = {
  today_sales: 0,
  today_count: 0,
  month_sales: 0,
  month_profit: 0,
  cash_total: 0,
  bank_total: 0,
  receivables: 0,
  payables: 0,
  low_stock: 0,
  pending_checks_in: 0,
  pending_checks_out: 0,
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [sales, setSales] = useState<Invoice[]>([])
  const [low, setLow] = useState<Product[]>([])
  const [name, setName] = useState('فروشگاه پلاسکو')

  useEffect(() => {
    const supabase = createClient()
    const today = todayIso()
    const j = todayJalali()
    const from = jalaliToIso(j.jy, j.jm, 1)
    supabase.from('company_settings').select('name').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data?.name) setName(data.name)
    })
    supabase.rpc('dashboard_stats', { p_today: today, p_month_from: from, p_month_to: today }).then(({ data }) => {
      setStats(data ? (data as DashboardStats) : EMPTY)
    })
    supabase
      .from('invoices')
      .select('*, party:parties(*)')
      .eq('kind', 'sale')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setSales((data || []) as Invoice[]))
    supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .eq('kind', 'goods')
      .then(({ data }) => {
        const rows = (data || []) as Product[]
        setLow(rows.filter((p) => Number(p.stock) <= Number(p.min_stock)).slice(0, 6))
      })
  }, [])

  if (!stats) return <Spinner />

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>{name}</h1>
          <div className="tiny">{formatJalaliLong(todayIso())}</div>
        </div>
        <Link href="/pos" className="btn">
          فروش جدید
        </Link>
      </div>

      <div className="grid stats">
        <div className="card stat-card accent">
          <div className="label">فروش امروز</div>
          <div className="value">
            <Money n={Number(stats.today_sales)} />
          </div>
          <div className="tiny" style={{ color: 'rgba(255,255,255,.8)' }}>
            {stats.today_count} فاکتور
          </div>
        </div>
        <div className="card stat-card">
          <div className="label">سود این ماه</div>
          <div className="value">
            <Money n={Number(stats.month_profit)} />
          </div>
        </div>
        <div className="card stat-card">
          <div className="label">صندوق و تنخواه</div>
          <div className="value">
            <Money n={Number(stats.cash_total)} />
          </div>
        </div>
        <div className="card stat-card">
          <div className="label">بانک</div>
          <div className="value">
            <Money n={Number(stats.bank_total)} />
          </div>
        </div>
        <div className="card stat-card">
          <div className="label">بدهکاران</div>
          <div className="value">
            <Money n={Number(stats.receivables)} />
          </div>
        </div>
        <div className="card stat-card">
          <div className="label">بستانکاران</div>
          <div className="value">
            <Money n={Number(stats.payables)} />
          </div>
        </div>
        <div className="card stat-card">
          <div className="label">چک‌های دریافتنی</div>
          <div className="value">
            <Money n={Number(stats.pending_checks_in)} />
          </div>
        </div>
        <div className="card stat-card">
          <div className="label">کالای کم‌موجود</div>
          <div className="value">{stats.low_stock}</div>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: '1fr' }}>
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h3>آخرین فروش‌ها</h3>
            <Link href="/sales" className="tiny">
              همه
            </Link>
          </div>
          {sales.length === 0 ? (
            <p className="muted">هنوز فروشی ثبت نشده.</p>
          ) : (
            sales.map((s) => (
              <Link key={s.id} href={`/sales/${s.id}`} className="list-item">
                <div>
                  <strong>{s.number}</strong>
                  <div className="tiny">{s.party?.name || 'مشتری متفرقه'}</div>
                </div>
                <Money n={s.total} />
              </Link>
            ))
          )}
        </div>
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h3>هشدار موجودی</h3>
            <Link href="/inventory" className="tiny">
              انبار
            </Link>
          </div>
          {low.length === 0 ? (
            <p className="muted">موجودی کالاها در حد مجاز است.</p>
          ) : (
            low.map((p) => (
              <div key={p.id} className="list-item">
                <div>
                  <strong>{p.name}</strong>
                  <div className="tiny">حداقل {p.min_stock}</div>
                </div>
                <div className="money">{p.stock}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
