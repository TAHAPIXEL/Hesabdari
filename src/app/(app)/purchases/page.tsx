'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatJalali } from '@/lib/jalali'
import type { Invoice } from '@/lib/types'
import { Badge, Empty, Money, Spinner, statusFa, statusKind } from '@/components/ui'

export default function PurchasesPage() {
  const [rows, setRows] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    createClient()
      .from('invoices')
      .select('*, party:parties(*)')
      .eq('kind', 'purchase')
      .order('issued_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setRows((data || []) as Invoice[])
        setLoading(false)
      })
  }, [])
  if (loading) return <Spinner />
  return (
    <div>
      <div className="topbar">
        <h1>خرید کالا</h1>
        <Link href="/purchases/new" className="btn">
          خرید جدید
        </Link>
      </div>
      {rows.length === 0 ? (
        <Empty title="خریدی ثبت نشده" action={<Link href="/purchases/new" className="btn">ثبت خرید</Link>} />
      ) : (
        <div className="card">
          {rows.map((s) => (
            <div key={s.id} className="list-item">
              <div>
                <strong>{s.number}</strong>
                <div className="tiny">
                  {formatJalali(s.issued_at)} — {s.party?.name || 'بدون تامین‌کننده'}
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <Money n={s.total} />
                <Badge kind={statusKind(s.status)}>{statusFa(s.status)}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
