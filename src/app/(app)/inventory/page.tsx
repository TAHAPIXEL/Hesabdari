'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatQty, formatRial, parseQty } from '@/lib/money'
import { formatJalali, todayIso } from '@/lib/jalali'
import type { Product, StockMove } from '@/lib/types'
import { Button, Field, Input, Modal, Spinner } from '@/components/ui'
import { useToast } from '@/components/Toast'

export default function InventoryPage() {
  const toast = useToast()
  const [rows, setRows] = useState<Product[]>([])
  const [moves, setMoves] = useState<StockMove[]>([])
  const [sel, setSel] = useState<Product | null>(null)
  const [open, setOpen] = useState(false)
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
          <div className="tiny">ارزش موجودی با قیمت خرید: {formatRial(value)}</div>
        </div>
      </div>
      <div className="card">
        {rows.map((p) => (
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
