'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRial, parseRial } from '@/lib/money'
import { formatJalali, jalaliYearOf, todayIso } from '@/lib/jalali'
import type { CashAccount, Expense } from '@/lib/types'
import { Button, DateField, Empty, Field, Input, Modal, Select, Spinner } from '@/components/ui'
import { useToast } from '@/components/Toast'

export default function ExpensesPage() {
  const toast = useToast()
  const [rows, setRows] = useState<Expense[]>([])
  const [cashes, setCashes] = useState<CashAccount[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', amount: '', cashId: '', date: todayIso(), notes: '' })

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('expenses').select('*').order('spent_at', { ascending: false }).limit(100)
    setRows((data || []) as Expense[])
    const { data: c } = await supabase.from('cash_accounts').select('*').eq('is_active', true)
    const acc = (c || []) as CashAccount[]
    setCashes(acc)
    if (!form.cashId && acc[0]) setForm((f) => ({ ...f, cashId: acc[0].id }))
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  async function save() {
    const { error } = await createClient().rpc('record_expense', {
      p_title: form.title,
      p_amount: parseRial(form.amount),
      p_spent_at: form.date,
      p_cash_account_id: form.cashId || null,
      p_notes: form.notes || null,
      p_jyear: jalaliYearOf(form.date),
    })
    if (error) return toast.push(error.message, 'err')
    toast.push('هزینه ثبت شد.')
    setOpen(false)
    setForm((f) => ({ ...f, title: '', amount: '', notes: '' }))
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="topbar">
        <h1>هزینه‌ها</h1>
        <Button onClick={() => setOpen(true)}>هزینه جدید</Button>
      </div>
      {rows.length === 0 ? (
        <Empty title="هزینه‌ای نیست" action={<Button onClick={() => setOpen(true)}>ثبت هزینه</Button>} />
      ) : (
        <div className="card">
          {rows.map((e) => (
            <div key={e.id} className="list-item">
              <div>
                <strong>{e.title}</strong>
                <div className="tiny">{formatJalali(e.spent_at)}</div>
              </div>
              <div className="money">{formatRial(e.amount)}</div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} title="ثبت هزینه" onClose={() => setOpen(false)}>
        <Field label="عنوان">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="اجاره، حمل، برق…" />
        </Field>
        <Field label="مبلغ (ریال)">
          <Input inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="از صندوق">
          <Select value={form.cashId} onChange={(e) => setForm({ ...form, cashId: e.target.value })}>
            {cashes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <DateField label="تاریخ" value={form.date} onChange={(d) => setForm({ ...form, date: d })} />
        <Button block onClick={save}>ثبت</Button>
      </Modal>
    </div>
  )
}
