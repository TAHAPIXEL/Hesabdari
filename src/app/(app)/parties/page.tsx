'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseRial } from '@/lib/money'
import type { Party, PartyKind } from '@/lib/types'
import { Badge, Button, CopyText, Empty, Field, Input, Modal, Money, Select, Spinner } from '@/components/ui'
import { useToast } from '@/components/Toast'

const empty = { name: '', kind: 'customer' as PartyKind, phone: '', mobile: '', national_id: '', address: '', opening_balance: '', notes: '' }

export default function PartiesPage() {
  const toast = useToast()
  const [rows, setRows] = useState<(Party & { balance?: number })[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Party | null>(null)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('parties').select('*').order('name')
    const list = (data || []) as Party[]
    const withBal = await Promise.all(
      list.map(async (p) => {
        const { data: b } = await supabase.rpc('party_balance', { p_id: p.id })
        return { ...p, balance: Number(b || 0) }
      }),
    )
    setRows(withBal)
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const filtered = rows.filter((p) => !q.trim() || p.name.includes(q) || (p.mobile || '').includes(q) || (p.phone || '').includes(q))

  function startNew() {
    setEdit(null)
    setForm(empty)
    setOpen(true)
  }
  function startEdit(p: Party) {
    setEdit(p)
    setForm({
      name: p.name,
      kind: p.kind,
      phone: p.phone || '',
      mobile: p.mobile || '',
      national_id: p.national_id || '',
      address: p.address || '',
      opening_balance: String(p.opening_balance || ''),
      notes: p.notes || '',
    })
    setOpen(true)
  }

  async function save() {
    if (!form.name.trim()) return toast.push('نام لازم است.', 'err')
    const supabase = createClient()
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      phone: form.phone.trim() || null,
      mobile: form.mobile.trim() || null,
      national_id: form.national_id.trim() || null,
      address: form.address.trim() || null,
      opening_balance: parseRial(form.opening_balance),
      notes: form.notes.trim() || null,
      is_active: true,
    }
    const q = edit ? supabase.from('parties').update(payload).eq('id', edit.id) : supabase.from('parties').insert(payload)
    const { error } = await q
    if (error) return toast.push(error.message, 'err')
    toast.push('ذخیره شد.')
    setOpen(false)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="topbar">
        <h1>اشخاص</h1>
        <Button onClick={startNew}>شخص جدید</Button>
      </div>
      <div className="search" style={{ marginBottom: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام یا موبایل" />
      </div>
      {filtered.length === 0 ? (
        <Empty title="هنوز کسی ثبت نشده" action={<Button onClick={startNew}>افزودن</Button>} />
      ) : (
        <div className="card">
          {filtered.map((p) => (
            <button key={p.id} type="button" className="list-item" style={{ width: '100%', background: 'none', border: 0 }} onClick={() => startEdit(p)}>
              <div style={{ textAlign: 'right' }}>
                <strong>{p.name}</strong>
                <div className="tiny">
                  {p.kind === 'supplier' ? 'تامین‌کننده' : p.kind === 'both' ? 'مشتری و تامین‌کننده' : 'مشتری'}
                  {p.mobile ? (
                    <span onClick={(e) => e.stopPropagation()}>
                      {' — '}
                      <CopyText value={p.mobile} />
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <Money n={p.balance || 0} />
                {(p.balance || 0) > 0 ? <Badge kind="warn">بدهکار</Badge> : (p.balance || 0) < 0 ? <Badge kind="gold">بستانکار</Badge> : <Badge>تسویه</Badge>}
              </div>
            </button>
          ))}
        </div>
      )}
      <Modal open={open} title={edit ? 'ویرایش شخص' : 'شخص جدید'} onClose={() => setOpen(false)}>
        <Field label="نام">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="نوع">
          <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PartyKind })}>
            <option value="customer">مشتری</option>
            <option value="supplier">تامین‌کننده</option>
            <option value="both">هر دو</option>
          </Select>
        </Field>
        <Field label="موبایل">
          <Input inputMode="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
        </Field>
        <Field label="تلفن">
          <Input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="کد ملی / شناسه">
          <Input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
        </Field>
        <Field label="مانده اول دوره (مثبت = بدهکار به ما)">
          <Input inputMode="numeric" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
        </Field>
        <Field label="آدرس">
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Button block onClick={save}>
          ذخیره
        </Button>
      </Modal>
    </div>
  )
}
