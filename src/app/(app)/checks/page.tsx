'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRial, parseRial } from '@/lib/money'
import { formatJalali, todayIso } from '@/lib/jalali'
import type { CashAccount, CheckRow, Party } from '@/lib/types'
import { Badge, Button, DateField, Empty, Field, Input, Modal, Select, Spinner, statusFa, statusKind } from '@/components/ui'
import { useToast } from '@/components/Toast'

export default function ChecksPage() {
  const toast = useToast()
  const [rows, setRows] = useState<CheckRow[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [cashes, setCashes] = useState<CashAccount[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    direction: 'in',
    partyId: '',
    cashId: '',
    number: '',
    bank: '',
    amount: '',
    issued: todayIso(),
    due: todayIso(),
    notes: '',
  })

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('checks').select('*, party:parties(*)').order('due_at')
    setRows((data || []) as CheckRow[])
    const { data: p } = await supabase.from('parties').select('*').eq('is_active', true).order('name')
    setParties((p || []) as Party[])
    const { data: c } = await supabase.from('cash_accounts').select('*').eq('is_active', true)
    setCashes((c || []) as CashAccount[])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  async function save() {
    const { error } = await createClient().rpc('record_check', {
      p_direction: form.direction,
      p_party_id: form.partyId || null,
      p_cash_account_id: form.cashId || null,
      p_number: form.number || null,
      p_bank_name: form.bank || null,
      p_amount: parseRial(form.amount),
      p_issued_at: form.issued,
      p_due_at: form.due,
      p_notes: form.notes || null,
    })
    if (error) return toast.push(error.message, 'err')
    toast.push('چک ثبت شد.')
    setOpen(false)
    load()
  }

  async function setStatus(id: string, status: string) {
    const { error } = await createClient().rpc('set_check_status', { p_id: id, p_status: status })
    if (error) return toast.push(error.message, 'err')
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="topbar">
        <h1>چک‌ها</h1>
        <Button onClick={() => setOpen(true)}>ثبت چک</Button>
      </div>
      {rows.length === 0 ? (
        <Empty title="چکی نیست" action={<Button onClick={() => setOpen(true)}>ثبت چک</Button>} />
      ) : (
        <div className="card">
          {rows.map((c) => (
            <div key={c.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <div>
                <strong>{c.direction === 'in' ? 'دریافتی' : 'پرداختی'}</strong>
                <div className="tiny">
                  {c.party?.name || '—'} — سررسید {formatJalali(c.due_at)}
                </div>
                <div className="tiny">{c.number} {c.bank_name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {c.status === 'pending' || c.status === 'deposited' ? (
                    <>
                      <Button small onClick={() => setStatus(c.id, 'cleared')}>پاس</Button>
                      <Button small variant="ghost" onClick={() => setStatus(c.id, 'bounced')}>برگشت</Button>
                    </>
                  ) : null}
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className="money">{formatRial(c.amount)}</div>
                <Badge kind={statusKind(c.status)}>{statusFa(c.status)}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} title="ثبت چک" onClose={() => setOpen(false)}>
        <Field label="نوع">
          <Select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
            <option value="in">دریافتی از مشتری</option>
            <option value="out">پرداختی به تامین‌کننده</option>
          </Select>
        </Field>
        <Field label="شخص">
          <Select value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
            <option value="">—</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="حساب بانکی برای پاس شدن">
          <Select value={form.cashId} onChange={(e) => setForm({ ...form, cashId: e.target.value })}>
            <option value="">بعداً</option>
            {cashes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="شماره چک">
          <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
        </Field>
        <Field label="بانک عهده">
          <Input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
        </Field>
        <Field label="مبلغ">
          <Input inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <DateField label="تاریخ صدور" value={form.issued} onChange={(d) => setForm({ ...form, issued: d })} />
        <DateField label="سررسید" value={form.due} onChange={(d) => setForm({ ...form, due: d })} />
        <Button block onClick={save}>ثبت</Button>
      </Modal>
    </div>
  )
}
