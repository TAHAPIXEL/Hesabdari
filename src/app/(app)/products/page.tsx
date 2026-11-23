'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatQty, formatRial, parseQty, parseRial } from '@/lib/money'
import { todayIso } from '@/lib/jalali'
import type { Category, Product } from '@/lib/types'
import { Badge, Button, Empty, Field, Input, Modal, Select, Spinner } from '@/components/ui'
import { useToast } from '@/components/Toast'

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  kind: 'goods' as 'goods' | 'service',
  category_id: '',
  unit: 'عدد',
  variant: '',
  buy_price: '',
  sell_price: '',
  stock: '',
  min_stock: '0',
  description: '',
}

export default function ProductsPage() {
  const toast = useToast()
  const [rows, setRows] = useState<Product[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
    ])
    setRows((p || []) as Product[])
    setCats((c || []) as Category[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = rows.filter((p) => {
    const s = q.trim()
    if (!s) return true
    return [p.name, p.sku, p.barcode, p.variant].some((x) => (x || '').includes(s))
  })

  function startNew() {
    setEdit(null)
    setForm(emptyForm)
    setOpen(true)
  }
  function startEdit(p: Product) {
    setEdit(p)
    setForm({
      name: p.name,
      sku: p.sku || '',
      barcode: p.barcode || '',
      kind: p.kind,
      category_id: p.category_id || '',
      unit: p.unit,
      variant: p.variant || '',
      buy_price: String(p.buy_price || ''),
      sell_price: String(p.sell_price || ''),
      stock: String(p.stock || ''),
      min_stock: String(p.min_stock || '0'),
      description: p.description || '',
    })
    setOpen(true)
  }

  async function save() {
    if (!form.name.trim()) return toast.push('نام کالا لازم است.', 'err')
    const supabase = createClient()
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      kind: form.kind,
      category_id: form.category_id || null,
      unit: form.unit || 'عدد',
      variant: form.variant.trim() || null,
      buy_price: parseRial(form.buy_price),
      sell_price: parseRial(form.sell_price),
      min_stock: parseQty(form.min_stock),
      description: form.description.trim() || null,
      is_active: true,
    }
    if (edit) {
      const { error } = await supabase.from('products').update(payload).eq('id', edit.id)
      if (error) return toast.push(error.message, 'err')
      toast.push('کالا ذخیره شد.')
    } else {
      const { data, error } = await supabase.from('products').insert({ ...payload, stock: 0 }).select('id').single()
      if (error || !data) return toast.push(error?.message || 'ثبت نشد', 'err')
      const stock = parseQty(form.stock)
      if (stock) {
        const { error: sErr } = await supabase.rpc('adjust_stock', {
          p_product_id: data.id,
          p_qty: stock,
          p_notes: 'موجودی اول دوره',
          p_moved_at: todayIso(),
        })
        if (sErr) return toast.push(sErr.message, 'err')
      }
      toast.push('کالا اضافه شد.')
    }
    setOpen(false)
    load()
  }

  async function toggle(p: Product) {
    const supabase = createClient()
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="topbar">
        <h1>کالاها</h1>
        <Button onClick={startNew}>کالای جدید</Button>
      </div>
      <div className="search" style={{ marginBottom: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی کالا" />
      </div>
      {filtered.length === 0 ? (
        <Empty title="کالایی نیست" text="اولین کالای پلاسکو را اضافه کنید." action={<Button onClick={startNew}>افزودن کالا</Button>} />
      ) : (
        <div className="card">
          {filtered.map((p) => (
            <button key={p.id} type="button" className="list-item" style={{ width: '100%', background: 'none', border: 0 }} onClick={() => startEdit(p)}>
              <div style={{ textAlign: 'right' }}>
                <strong>{p.name}</strong>
                <div className="tiny">
                  {p.kind === 'service' ? 'خدمات' : `موجودی ${formatQty(p.stock)} ${p.unit}`}
                  {!p.is_active ? ' — غیرفعال' : ''}
                </div>
              </div>
              <div>
                <div className="money">{formatRial(p.sell_price)}</div>
                {p.kind === 'goods' && Number(p.stock) <= Number(p.min_stock) ? <Badge kind="warn">کم‌موجود</Badge> : null}
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={open} title={edit ? 'ویرایش کالا' : 'کالای جدید'} onClose={() => setOpen(false)}>
        <Field label="نام">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="نوع">
          <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'goods' | 'service' })}>
            <option value="goods">کالا</option>
            <option value="service">خدمات</option>
          </Select>
        </Field>
        <Field label="گروه">
          <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">بدون گروه</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="سایز / مدل">
          <Input value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} />
        </Field>
        <div className="grid stats">
          <Field label="واحد">
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </Field>
          <Field label="بارکد">
            <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          </Field>
        </div>
        <Field label="کد کالا">
          <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </Field>
        <div className="grid stats">
          <Field label="قیمت خرید (ریال)">
            <Input inputMode="numeric" value={form.buy_price} onChange={(e) => setForm({ ...form, buy_price: e.target.value })} />
          </Field>
          <Field label="قیمت فروش (ریال)">
            <Input inputMode="numeric" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} />
          </Field>
        </div>
        {!edit ? (
          <Field label="موجودی اول">
            <Input inputMode="decimal" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </Field>
        ) : (
          <p className="tiny">برای تغییر موجودی از بخش انبار استفاده کنید.</p>
        )}
        <Field label="حداقل موجودی">
          <Input inputMode="decimal" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
        </Field>
        <Field label="توضیح">
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Button block onClick={save}>
          ذخیره
        </Button>
        {edit ? (
          <Button variant="ghost" block style={{ marginTop: 8 }} onClick={() => toggle(edit)}>
            {edit.is_active ? 'غیرفعال کردن' : 'فعال کردن'}
          </Button>
        ) : null}
      </Modal>
    </div>
  )
}
