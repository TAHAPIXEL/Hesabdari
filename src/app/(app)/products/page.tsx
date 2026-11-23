'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { findByBarcode } from '@/lib/catalog'
import { formatQty, parseQty, parseRial } from '@/lib/money'
import { todayIso } from '@/lib/jalali'
import type { Category, Product } from '@/lib/types'
import { Badge, Button, CopyText, Empty, Field, Input, Modal, Money, Select, Spinner } from '@/components/ui'
import { SearchBar, Scanner } from '@/components/Scanner'
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
  const [scanField, setScanField] = useState(false)
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

  useEffect(() => {
    const editId = sessionStorage.getItem('scan-edit')
    const neu = sessionStorage.getItem('scan-new')
    if (editId) {
      sessionStorage.removeItem('scan-edit')
      createClient()
        .from('products')
        .select('*')
        .eq('id', editId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) startEdit(data as Product)
        })
    } else if (neu) {
      sessionStorage.removeItem('scan-new')
      setEdit(null)
      setForm({ ...emptyForm, barcode: neu })
      setOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function onListScan(code: string) {
    const found = await findByBarcode(code)
    if (found[0]) {
      startEdit(found[0])
      setQ(code)
    } else {
      setEdit(null)
      setForm({ ...emptyForm, barcode: code })
      setOpen(true)
      toast.push('کالا نبود؛ بارکد در فرم جدید نشست.')
    }
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
    await createClient().from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="topbar">
        <h1>کالاها</h1>
        <Button onClick={startNew}>کالای جدید</Button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <SearchBar value={q} onChange={setQ} onScan={onListScan} placeholder="جستجو یا اسکن بارکد" />
      </div>
      {filtered.length === 0 ? (
        <Empty title="کالایی نیست" text="اولین کالا را اضافه کن یا بارکد را اسکن کن." action={<Button onClick={startNew}>افزودن کالا</Button>} />
      ) : (
        <div className="card">
          {filtered.map((p) => (
            <button key={p.id} type="button" className="list-item" style={{ width: '100%', background: 'none', border: 0 }} onClick={() => startEdit(p)}>
              <div style={{ textAlign: 'right' }}>
                <strong>{p.name}</strong>
                <div className="tiny">
                  {p.kind === 'service' ? 'خدمات' : `موجودی ${formatQty(p.stock)} ${p.unit}`}
                  {!p.is_active ? ' — غیرفعال' : ''}
                  {p.barcode ? (
                    <span onClick={(e) => e.stopPropagation()}>
                      {' — '}
                      <CopyText value={p.barcode} />
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <Money n={p.sell_price} />
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
            <div className="search" style={{ padding: 0, minHeight: 46 }}>
              <input className="input" style={{ border: 0 }} value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              <button type="button" className="scan-mini" onClick={() => setScanField(true)}>
                اسکن
              </button>
            </div>
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
      {scanField ? (
        <Scanner
          title="اسکن بارکد کالا"
          onClose={() => setScanField(false)}
          onResult={(code) => {
            setScanField(false)
            setForm((f) => ({ ...f, barcode: code }))
          }}
        />
      ) : null}
    </div>
  )
}
