'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { findByBarcode } from '@/lib/catalog'
import { formatQty, parseQty } from '@/lib/money'
import { formatJalali, todayIso } from '@/lib/jalali'
import type { Product, StockMove } from '@/lib/types'
import { Button, Field, Input, Modal, Money, Spinner } from '@/components/ui'
import { SearchBar } from '@/components/Scanner'
import { useToast } from '@/components/Toast'

export default function InventoryPage() {
  const toast = useToast()
  const [rows, setRows] = useState<Product[]>([])
  const [moves, setMoves] = useState<StockMove[]>([])
  const [sel, setSel] = useState<Product | null>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('اصلاح موجودی')
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('products').select('*').eq('kind', 'goods').eq('is_active', true).order('name')
    setRows((data || []) as Product[])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const id = sessionStorage.getItem('scan-stock')
    if (!id) return
    sessionStorage.removeItem('scan-stock')
    createClient()
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) openKardex(data as Product)
      })
  }, [])

  async function onScan(code: string) {
    const found = await findByBarcode(code)
    if (found[0]) openKardex(found[0])
    else toast.push(`بارکد ${code} پیدا نشد`, 'err')
  }

  async function openKardex(p: Product) {
    setSel(p)
    const { data } = await createClient()
      .from('stock_moves')
      .select('*, product:products(*)')
      .eq('product_id', p.id)
      .order('moved_at', { ascending: false })
      .limit(50)
    setMoves((data || []) as StockMove[])
  }

  async function adjust() {
    if (!sel) return
    const { error } = await createClient().rpc('adjust_stock', {
      p_product_id: sel.id,
      p_qty: parseQty(qty),
      p_notes: notes,
      p_moved_at: todayIso(),
    })
    if (error) return toast.push(error.message, 'err')
    toast.push('موجودی اصلاح شد.')
    setOpen(false)
    setQty('')
    load()
    openKardex(sel)
  }

  if (loading) return <Spinner />
  const value = rows.reduce((s, p) => s + Math.round(Number(p.stock) * Number(p.buy_price)), 0)

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>انبار</h1>
          <div className="tiny">
            ارزش موجودی با قیمت خرید: <Money n={value} />
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <SearchBar value={q} onChange={setQ} onScan={onScan} placeholder="جستجو یا اسکن کالا در انبار" />
      </div>
      <div className="card">
        {rows
          .filter((p) => !q.trim() || [p.name, p.barcode, p.sku].some((x) => (x || '').includes(q.trim())))
          .map((p) => (
          <button key={p.id} type="button" className="list-item" style={{ width: '100%', background: 'none', border: 0 }} onClick={() => openKardex(p)}>
            <div style={{ textAlign: 'right' }}>
              <strong>{p.name}</strong>
              <div className="tiny">حداقل {formatQty(p.min_stock)}</div>
            </div>
            <div className="money">
              {formatQty(p.stock)} {p.unit}
            </div>
          </button>
        ))}
      </div>
      {sel ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row">
            <h3>کاردکس {sel.name}</h3>
            <Button small onClick={() => setOpen(true)}>اصلاح موجودی</Button>
          </div>
          {moves.map((m) => (
            <div key={m.id} className="list-item">
              <div>
                <strong>{m.reason === 'sale' ? 'فروش' : m.reason === 'purchase' ? 'خرید' : m.reason === 'adjust' ? 'اصلاح' : m.reason}</strong>
                <div className="tiny">{formatJalali(m.moved_at)} {m.notes}</div>
              </div>
              <div className="money">{m.qty > 0 ? '+' : ''}{formatQty(m.qty)}</div>
            </div>
          ))}
        </div>
      ) : null}
      <Modal open={open} title="اصلاح موجودی" onClose={() => setOpen(false)}>
        <p className="tiny">عدد مثبت ورود به انبار، عدد منفی خروج.</p>
        <Field label="تعداد (+ یا −)">
          <Input value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="شرح">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button block onClick={adjust}>ثبت</Button>
      </Modal>
    </div>
  )
}
