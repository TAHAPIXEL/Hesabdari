'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { findByBarcode, searchProducts } from '@/lib/catalog'
import { formatQty, lineTotal, parseQty, parseRial } from '@/lib/money'
import { jalaliYearOf, todayIso } from '@/lib/jalali'
import type { CartLine, CashAccount, Party, Product } from '@/lib/types'
import { Button, Field, Input, Money, Select } from '@/components/ui'
import { SearchBar } from '@/components/Scanner'
import { useToast } from '@/components/Toast'

export default function PosPage() {
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
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [vatDefault, setVatDefault] = useState(0)

  function addProduct(p: Product) {
    setCart((c) => {
      const i = c.findIndex((x) => x.product_id === p.id)
      if (i >= 0) {
        const n = [...c]
        n[i] = { ...n[i], qty: n[i].qty + 1 }
        return n
      }
      return [
        ...c,
        {
          key: p.id,
          product_id: p.id,
          description: p.name + (p.variant ? ` — ${p.variant}` : ''),
          unit: p.unit,
          qty: 1,
          unit_price: Number(p.sell_price),
          discount: 0,
          vat_percent: p.vat_percent == null ? vatDefault : Number(p.vat_percent),
          cost_price: Number(p.buy_price),
          stock: Number(p.stock),
          kind: p.kind,
        },
      ]
    })
    toast.push(`${p.name} اضافه شد`)
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.from('parties').select('*').eq('is_active', true).order('name').then(({ data }) => setParties((data || []) as Party[]))
    supabase.from('cash_accounts').select('*').eq('is_active', true).order('name').then(({ data }) => {
      const rows = (data || []) as CashAccount[]
      setCashes(rows)
      if (rows[0]) setCashId(rows[0].id)
    })
    supabase.from('company_settings').select('vat_percent').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setVatDefault(Number(data.vat_percent || 0))
    })
  }, [])

  useEffect(() => {
    const id = sessionStorage.getItem('scan-add')
    if (!id) return
    sessionStorage.removeItem('scan-add')
    createClient()
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) addProduct(data as Product)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      const query = q.trim()
      if (!query) {
        setFound([])
        return
      }
      const rows = await searchProducts(query)
      const exact = rows.find((p) => p.barcode === query || p.sku === query)
      if (exact && /^\d{4,}$/.test(query)) {
        addProduct(exact)
        setQ('')
        setFound([])
        return
      }
      setFound(rows)
    }, 160)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  async function onScan(code: string) {
    const rows = await findByBarcode(code)
    if (rows[0]) {
      addProduct(rows[0])
      setQ('')
      setFound([])
    } else {
      toast.push(`بارکد ${code} پیدا نشد`, 'err')
      sessionStorage.setItem('scan-new', code)
      router.push('/products')
    }
  }

  const subtotal = useMemo(() => cart.reduce((s, l) => s + lineTotal(l.qty, l.unit_price, l.discount), 0), [cart])
  const vat = useMemo(
    () => cart.reduce((s, l) => s + Math.round((lineTotal(l.qty, l.unit_price, l.discount) * (l.vat_percent || 0)) / 100), 0),
    [cart],
  )
  const total = subtotal + vat

  useEffect(() => {
    if (method === 'credit') setPaid('0')
    else setPaid(String(total))
  }, [total, method])

  async function submit() {
    if (!cart.length) return toast.push('سبد فروش خالی است.', 'err')
    if (method !== 'credit' && !cashId) return toast.push('صندوق را انتخاب کنید.', 'err')
    if (method === 'credit' && !partyId) return toast.push('برای فروش نسیه مشتری را انتخاب کنید.', 'err')
    setBusy(true)
    const paidN = method === 'credit' ? 0 : parseRial(paid)
    const { data, error } = await createClient().rpc('create_sale', {
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
      p_paid: paidN,
      p_method: method,
      p_notes: notes || null,
      p_issued_at: todayIso(),
      p_jyear: jalaliYearOf(),
    })
    setBusy(false)
    if (error) return toast.push(error.message, 'err')
    toast.push('فروش ثبت شد.')
    router.push(`/sales/${data}`)
  }

  return (
    <div className="pos-layout">
      <div>
        <div className="topbar">
          <h1>فروش سریع</h1>
        </div>
        <SearchBar value={q} onChange={setQ} onScan={onScan} placeholder="جستجو یا اسکن بارکد" />
        <div className="card" style={{ marginTop: 12 }}>
          {found.length === 0 && !q ? <p className="muted">نام را بنویس یا دکمه اسکن را بزن.</p> : null}
          {found.map((p) => (
            <button key={p.id} type="button" className="list-item" style={{ width: '100%', background: 'none', border: 0 }} onClick={() => addProduct(p)}>
              <div style={{ textAlign: 'right' }}>
                <strong>{p.name}</strong>
                <div className="tiny">{p.kind === 'goods' ? `موجودی ${formatQty(p.stock)} ${p.unit}` : 'خدمات'}</div>
              </div>
              <Money n={p.sell_price} copy={false} />
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>سبد</h3>
        {cart.length === 0 ? <p className="muted">خالی — اسکن کن یا جستجو کن</p> : null}
        {cart.map((l, idx) => (
          <div key={l.key} className="cart-line">
            <div>
              <strong>{l.description}</strong>
              <div className="tiny">
                <Money n={l.unit_price} copy={false} />
              </div>
              <div className="qty" style={{ marginTop: 6 }}>
                <button type="button" onClick={() => setCart((c) => c.map((x, i) => (i === idx ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}>
                  −
                </button>
                <input
                  value={l.qty}
                  onChange={(e) => {
                    const n = parseQty(e.target.value)
                    setCart((c) => c.map((x, i) => (i === idx ? { ...x, qty: n } : x)))
                  }}
                />
                <button type="button" onClick={() => setCart((c) => c.map((x, i) => (i === idx ? { ...x, qty: x.qty + 1 } : x)))}>
                  +
                </button>
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <Money n={lineTotal(l.qty, l.unit_price, l.discount)} copy={false} />
              <button type="button" className="tiny" style={{ background: 'none', border: 0, color: 'var(--danger)' }} onClick={() => setCart((c) => c.filter((_, i) => i !== idx))}>
                حذف
              </button>
            </div>
          </div>
        ))}

        <div className="list-item">
          <span>جمع جزء</span>
          <Money n={subtotal} />
        </div>
        {vat ? (
          <div className="list-item">
            <span>مالیات</span>
            <Money n={vat} />
          </div>
        ) : null}
        <div className="list-item">
          <strong>قابل پرداخت</strong>
          <Money n={total} />
        </div>

        <Field label="مشتری">
          <Select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">مشتری متفرقه</option>
            {parties
              .filter((p) => p.kind !== 'supplier')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="نحوه تسویه">
          <Select value={method} onChange={(e) => setMethod(e.target.value as 'cash' | 'card' | 'credit')}>
            <option value="cash">نقد</option>
            <option value="card">کارت‌خوان</option>
            <option value="credit">نسیه</option>
          </Select>
        </Field>
        {method !== 'credit' ? (
          <>
            <Field label="صندوق / بانک">
              <Select value={cashId} onChange={(e) => setCashId(e.target.value)}>
                {cashes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="مبلغ دریافتی (ریال)">
              <Input inputMode="numeric" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </Field>
          </>
        ) : null}
        <Field label="توضیح">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button block disabled={busy} onClick={submit}>
          {busy ? 'در حال ثبت…' : 'ثبت فروش'}
        </Button>
      </div>
    </div>
  )
}
