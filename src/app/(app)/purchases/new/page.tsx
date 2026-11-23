'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { lineTotal, parseQty, parseRial } from '@/lib/money'
import { jalaliYearOf, todayIso } from '@/lib/jalali'
import type { CartLine, CashAccount, Party, Product } from '@/lib/types'
import { Button, DateField, Field, Input, Money, Select } from '@/components/ui'
import { SearchBar } from '@/components/Scanner'
import { findByBarcode, searchProducts } from '@/lib/catalog'
import { useToast } from '@/components/Toast'

export default function NewPurchasePage() {
  const router = useRouter()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Product[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [cashes, setCashes] = useState<CashAccount[]>([])
  const [partyId, setPartyId] = useState('')
  const [cashId, setCashId] = useState('')
  const [method, setMethod] = useState<'cash' | 'card' | 'credit'>('cash')
  const [paid, setPaid] = useState('')
  const [date, setDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('parties').select('*').eq('is_active', true).order('name').then(({ data }) => setParties((data || []) as Party[]))
    supabase.from('cash_accounts').select('*').eq('is_active', true).then(({ data }) => {
      const rows = (data || []) as CashAccount[]
      setCashes(rows)
      if (rows[0]) setCashId(rows[0].id)
    })
  }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) return setFound([])
      setFound(await searchProducts(q.trim(), 15))
    }, 160)
    return () => clearTimeout(t)
  }, [q])

  async function onScan(code: string) {
    const rows = await findByBarcode(code)
    if (rows[0]) add(rows[0])
    else toast.push(`بارکد ${code} پیدا نشد`, 'err')
  }

  function add(p: Product) {
    setCart((c) => [
      ...c,
      {
        key: `${p.id}-${c.length}`,
        product_id: p.id,
        description: p.name,
        unit: p.unit,
        qty: 1,
        unit_price: Number(p.buy_price),
        discount: 0,
        vat_percent: 0,
        cost_price: Number(p.buy_price),
        stock: Number(p.stock),
        kind: p.kind,
      },
    ])
    setQ('')
    setFound([])
  }

  const total = useMemo(() => cart.reduce((s, l) => s + lineTotal(l.qty, l.unit_price, l.discount), 0), [cart])
  useEffect(() => {
    if (method === 'credit') setPaid('0')
    else setPaid(String(total))
  }, [total, method])

  async function submit() {
    if (!cart.length) return toast.push('کالایی انتخاب نشده.', 'err')
    setBusy(true)
    const { data, error } = await createClient().rpc('create_purchase', {
      p_party_id: partyId || null,
      p_cash_account_id: method === 'credit' ? null : cashId || null,
      p_items: cart.map((l) => ({
        product_id: l.product_id,
        description: l.description,
        qty: l.qty,
        unit_price: l.unit_price,
        discount: l.discount,
        vat_percent: l.vat_percent,
      })),
      p_discount: 0,
      p_paid: method === 'credit' ? 0 : parseRial(paid),
      p_method: method,
      p_notes: notes || null,
      p_issued_at: date,
      p_jyear: jalaliYearOf(date),
    })
    setBusy(false)
    if (error) return toast.push(error.message, 'err')
    toast.push('خرید ثبت شد.')
    router.replace('/purchases')
    return data
  }

  return (
    <div>
      <div className="topbar">
        <h1>خرید جدید</h1>
      </div>
      <div className="card">
        <SearchBar value={q} onChange={setQ} onScan={onScan} placeholder="جستجو یا اسکن بارکد خرید" />
        {found.map((p) => (
          <button key={p.id} type="button" className="list-item" style={{ width: '100%', background: 'none', border: 0 }} onClick={() => add(p)}>
            <span>{p.name}</span>
            <Money n={p.buy_price} copy={false} />
          </button>
        ))}
        {cart.map((l, idx) => (
          <div key={l.key} className="cart-line">
            <div>
              <strong>{l.description}</strong>
              <div className="qty" style={{ marginTop: 6 }}>
                <button type="button" onClick={() => setCart((c) => c.map((x, i) => (i === idx ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}>−</button>
                <input value={l.qty} onChange={(e) => setCart((c) => c.map((x, i) => (i === idx ? { ...x, qty: parseQty(e.target.value) } : x)))} />
                <button type="button" onClick={() => setCart((c) => c.map((x, i) => (i === idx ? { ...x, qty: x.qty + 1 } : x)))}>+</button>
              </div>
              <Field label="فی خرید">
                <Input inputMode="numeric" value={l.unit_price} onChange={(e) => setCart((c) => c.map((x, i) => (i === idx ? { ...x, unit_price: parseRial(e.target.value) } : x)))} />
              </Field>
            </div>
            <div>
              <Money n={lineTotal(l.qty, l.unit_price, l.discount)} copy={false} />
              <button type="button" className="tiny" style={{ background: 'none', border: 0, color: 'var(--danger)' }} onClick={() => setCart((c) => c.filter((_, i) => i !== idx))}>
                حذف
              </button>
            </div>
          </div>
        ))}
        <div className="list-item">
          <strong>جمع</strong>
          <Money n={total} />
        </div>
        <Field label="تامین‌کننده">
          <Select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">بدون نام</option>
            {parties.filter((p) => p.kind !== 'customer').map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <DateField label="تاریخ" value={date} onChange={setDate} />
        <Field label="پرداخت">
          <Select value={method} onChange={(e) => setMethod(e.target.value as 'cash' | 'card' | 'credit')}>
            <option value="cash">نقد</option>
            <option value="card">کارت</option>
            <option value="credit">نسیه / حساب</option>
          </Select>
        </Field>
        {method !== 'credit' ? (
          <>
            <Field label="از صندوق">
              <Select value={cashId} onChange={(e) => setCashId(e.target.value)}>
                {cashes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="مبلغ پرداختی">
              <Input inputMode="numeric" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </Field>
          </>
        ) : null}
        <Field label="توضیح">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button block disabled={busy} onClick={submit}>ثبت خرید</Button>
      </div>
    </div>
  )
}
