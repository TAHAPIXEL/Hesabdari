'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatQty, formatRial } from '@/lib/money'
import { formatJalaliLong } from '@/lib/jalali'
import type { Company, Invoice, InvoiceItem } from '@/lib/types'
import { Badge, Button, CopyText, Money, Spinner, statusFa, statusKind } from '@/components/ui'
import { useToast } from '@/components/Toast'

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const [inv, setInv] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [company, setCompany] = useState<Company | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('invoices').select('*, party:parties(*)').eq('id', id).single().then(({ data }) => setInv(data as Invoice))
    supabase.from('invoice_items').select('*').eq('invoice_id', id).then(({ data }) => setItems((data || []) as InvoiceItem[]))
    supabase.from('company_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => setCompany(data as Company))
  }, [id])

  async function cancel() {
    if (!confirm('این فاکتور ابطال شود؟ موجودی و صندوق برمی‌گردد.')) return
    const { error } = await createClient().rpc('cancel_invoice', { p_id: id })
    if (error) return toast.push(error.message, 'err')
    toast.push('فاکتور ابطال شد.')
    router.replace('/sales')
  }

  if (!inv) return <Spinner />

  return (
    <div>
      <div className="topbar no-print">
        <h1>
          <CopyText value={inv.number} />
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={() => window.print()}>
            چاپ
          </Button>
          {inv.status !== 'cancelled' ? (
            <Button variant="danger" onClick={cancel}>
              ابطال
            </Button>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="row">
          <div>
            <h2>{company?.name || 'فروشگاه پلاسکو'}</h2>
            <div className="tiny">{company?.address}</div>
            <div className="tiny">{company?.phone}</div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <Badge kind={statusKind(inv.status)}>{statusFa(inv.status)}</Badge>
            <div className="tiny">{formatJalaliLong(inv.issued_at)}</div>
          </div>
        </div>
        <p>
          خریدار: <strong>{inv.party?.name || 'مشتری متفرقه'}</strong>
        </p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>شرح</th>
                <th>تعداد</th>
                <th>فی</th>
                <th>جمع</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.description}</td>
                  <td>{formatQty(it.qty)}</td>
                  <td>{formatRial(it.unit_price)}</td>
                  <td>{formatRial(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="list-item">
          <span>جمع جزء</span>
          <Money n={inv.subtotal} />
        </div>
        {inv.vat ? (
          <div className="list-item">
            <span>مالیات</span>
            <Money n={inv.vat} />
          </div>
        ) : null}
        <div className="list-item">
          <strong>جمع کل</strong>
          <Money n={inv.total} />
        </div>
        <div className="list-item">
          <span>دریافت‌شده</span>
          <Money n={inv.paid} />
        </div>
        <div className="list-item">
          <span>مانده</span>
          <Money n={inv.total - inv.paid} />
        </div>
        {inv.notes ? <p className="tiny">{inv.notes}</p> : null}
      </div>
    </div>
  )
}
