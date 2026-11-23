'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRial } from '@/lib/money'
import { formatJalali } from '@/lib/jalali'
import type { Invoice } from '@/lib/types'
import { Badge, Empty, Spinner, statusFa, statusKind } from '@/components/ui'

export default function SalesPage() {
  const [rows, setRows] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient()
      .from('invoices')
      .select('*, party:parties(*)')
      .eq('kind', 'sale')
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
        <h1>فاکتورهای فروش</h1>
        <Link href="/pos" className="btn">
          فروش جدید
        </Link>
      </div>
      {rows.length === 0 ? (
        <Empty title="فروشی ثبت نشده" action={<Link href="/pos" className="btn">اولین فروش</Link>} />
      ) : (
        <div className="card">
          {rows.map((s) => (
            <Link key={s.id} href={`/sales/${s.id}`} className="list-item">
              <div>
                <strong>{s.number}</strong>
                <div className="tiny">
                  {formatJalali(s.issued_at)} — {s.party?.name || 'متفرقه'}
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className="money">{formatRial(s.total)}</div>
                <Badge kind={statusKind(s.status)}>{statusFa(s.status)}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
