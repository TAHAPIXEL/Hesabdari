'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatQty, formatRial } from '@/lib/money'
import { jalaliToIso, todayIso, todayJalali } from '@/lib/jalali'
import { DateField, Spinner } from '@/components/ui'

type Top = { name: string; qty: number; sales: number; profit: number }

export default function ReportsPage() {
  const j = todayJalali()
  const [from, setFrom] = useState(jalaliToIso(j.jy, j.jm, 1))
  const [to, setTo] = useState(todayIso())
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState(0)
  const [cogs, setCogs] = useState(0)
  const [profit, setProfit] = useState(0)
  const [exp, setExp] = useState(0)
  const [top, setTop] = useState<Top[]>([])

  useEffect(() => {
    setLoading(true)
    const supabase = createClient()
    Promise.all([
      supabase.from('invoices').select('id,total').eq('kind', 'sale').in('status', ['issued', 'paid', 'partial']).gte('issued_at', from).lte('issued_at', to),
      supabase.from('invoice_items').select('description,qty,total,cost_price,invoice:invoices!inner(kind,status,issued_at)'),
      supabase.from('expenses').select('amount').gte('spent_at', from).lte('spent_at', to),
    ]).then(([inv, items, expenses]) => {
      const saleInvs = inv.data || []
      setSales(saleInvs.reduce((s, r) => s + Number(r.total), 0))
      const map = new Map<string, Top>()
      let cost = 0
      let prof = 0
      for (const it of items.data || []) {
        const invoice = it.invoice as unknown as { kind: string; status: string; issued_at: string }
        if (!invoice || invoice.kind !== 'sale' || !['issued', 'paid', 'partial'].includes(invoice.status)) continue
        if (invoice.issued_at < from || invoice.issued_at > to) continue
        const lineCost = Math.round(Number(it.qty) * Number(it.cost_price))
        const lineProf = Number(it.total) - lineCost
        cost += lineCost
        prof += lineProf
        const cur = map.get(it.description) || { name: it.description, qty: 0, sales: 0, profit: 0 }
        cur.qty += Number(it.qty)
        cur.sales += Number(it.total)
        cur.profit += lineProf
        map.set(it.description, cur)
      }
      setCogs(cost)
      setProfit(prof)
      setExp((expenses.data || []).reduce((s, r) => s + Number(r.amount), 0))
      setTop([...map.values()].sort((a, b) => b.sales - a.sales).slice(0, 12))
      setLoading(false)
    })
  }, [from, to])

  return (
    <div>
      <div className="topbar">
        <h1>گزارش‌ها</h1>
      </div>
      <div className="card">
        <DateField label="از تاریخ" value={from} onChange={setFrom} />
        <DateField label="تا تاریخ" value={to} onChange={setTo} />
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid stats" style={{ marginTop: 12 }}>
            <div className="card stat-card">
              <div className="label">فروش</div>
              <div className="value">{formatRial(sales)}</div>
            </div>
            <div className="card stat-card">
              <div className="label">بهای تمام‌شده</div>
              <div className="value">{formatRial(cogs)}</div>
            </div>
            <div className="card stat-card">
              <div className="label">سود ناخالص</div>
              <div className="value">{formatRial(profit)}</div>
            </div>
            <div className="card stat-card">
              <div className="label">هزینه‌ها</div>
              <div className="value">{formatRial(exp)}</div>
            </div>
            <div className="card stat-card accent">
              <div className="label">سود خالص</div>
              <div className="value">{formatRial(profit - exp)}</div>
            </div>
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <h3>پرفروش‌ترین کالاها</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>کالا</th>
                    <th>تعداد</th>
                    <th>فروش</th>
                    <th>سود</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((t) => (
                    <tr key={t.name}>
                      <td>{t.name}</td>
                      <td>{formatQty(t.qty)}</td>
                      <td>{formatRial(t.sales)}</td>
                      <td>{formatRial(t.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
