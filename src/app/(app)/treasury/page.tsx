'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRial, parseRial } from '@/lib/money'
import { jalaliYearOf, todayIso } from '@/lib/jalali'
import type { CashAccount, Party } from '@/lib/types'
import { Button, DateField, Field, Input, Modal, Select, Seg, Spinner } from '@/components/ui'
import { useToast } from '@/components/Toast'

export default function TreasuryPage() {
  const toast = useToast()
  const [accounts, setAccounts] = useState<(CashAccount & { balance: number })[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [tab, setTab] = useState('pay')
  const [openAcc, setOpenAcc] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ kind: 'receive', partyId: '', cashId: '', amount: '', method: 'cash', notes: '', date: todayIso() })
  const [tr, setTr] = useState({ from: '', to: '', amount: '', date: todayIso(), notes: '' })
  const [acc, setAcc] = useState({ name: '', kind: 'bank', bank_name: '', sheba: '', opening: '' })

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('cash_accounts').select('*').eq('is_active', true).order('name')
    const rows = (data || []) as CashAccount[]
    const withBal = await Promise.all(
      rows.map(async (c) => {
        const { data: b } = await supabase.rpc('cash_balance', { p_id: c.id })
        return { ...c, balance: Number(b || 0) }
      }),
    )
    setAccounts(withBal)
    if (!form.cashId && withBal[0]) setForm((f) => ({ ...f, cashId: withBal[0].id }))
    if (!tr.from && withBal[0]) setTr((t) => ({ ...t, from: withBal[0].id, to: withBal[1]?.id || withBal[0].id }))
    const { data: p } = await supabase.from('parties').select('*').eq('is_active', true).order('name')
    setParties((p || []) as Party[])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  async function savePay() {
    const { error } = await createClient().rpc('record_payment', {
      p_kind: form.kind,
      p_party_id: form.partyId || null,
      p_cash_account_id: form.cashId || null,
      p_invoice_id: null,
      p_amount: parseRial(form.amount),
      p_method: form.method,
      p_paid_at: form.date,
      p_notes: form.notes || null,
    })
    if (error) return toast.push(error.message, 'err')
    toast.push('ثبت شد.')
    setForm((f) => ({ ...f, amount: '', notes: '' }))
    load()
  }

  async function saveTransfer() {
    const { error } = await createClient().rpc('transfer_cash', {
      p_from: tr.from,
      p_to: tr.to,
      p_amount: parseRial(tr.amount),
      p_at: tr.date,
      p_notes: tr.notes || null,
    })
    if (error) return toast.push(error.message, 'err')
    toast.push('انتقال انجام شد.')
    setTr((t) => ({ ...t, amount: '', notes: '' }))
    load()
  }

  async function saveAcc() {
    if (!acc.name.trim()) return toast.push('نام حساب لازم است.', 'err')
    const { error } = await createClient().from('cash_accounts').insert({
      name: acc.name.trim(),
      kind: acc.kind,
      account_code: acc.kind === 'bank' ? '1102' : acc.kind === 'petty' ? '1103' : '1101',
      bank_name: acc.bank_name || null,
      sheba: acc.sheba || null,
      opening_balance: parseRial(acc.opening),
    })
    if (error) return toast.push(error.message, 'err')
    toast.push('حساب اضافه شد.')
    setOpenAcc(false)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="topbar">
        <h1>صندوق و بانک</h1>
        <Button variant="ghost" onClick={() => setOpenAcc(true)}>حساب جدید</Button>
      </div>
      <div className="grid stats">
        {accounts.map((c) => (
          <div key={c.id} className="card stat-card">
            <div className="label">{c.name}</div>
            <div className="value">{formatRial(c.balance)}</div>
            <div className="tiny">{c.kind === 'bank' ? 'بانک' : c.kind === 'petty' ? 'تنخواه' : 'صندوق'}</div>
          </div>
        ))}
      </div>
      <div style={{ height: 16 }} />
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { id: 'pay', label: 'دریافت / پرداخت' },
          { id: 'tr', label: 'انتقال' },
        ]}
      />
      {tab === 'pay' ? (
        <div className="card" style={{ marginTop: 12 }}>
          <Field label="نوع">
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="receive">دریافت</option>
              <option value="pay">پرداخت</option>
            </Select>
          </Field>
          <Field label="شخص">
            <Select value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
              <option value="">بدون شخص</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="صندوق / بانک">
            <Select value={form.cashId} onChange={(e) => setForm({ ...form, cashId: e.target.value })}>
              {accounts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="مبلغ (ریال)">
            <Input inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <DateField label="تاریخ" value={form.date} onChange={(d) => setForm({ ...form, date: d })} />
          <Field label="توضیح">
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <Button block onClick={savePay}>ثبت</Button>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          <Field label="از">
            <Select value={tr.from} onChange={(e) => setTr({ ...tr, from: e.target.value })}>
              {accounts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="به">
            <Select value={tr.to} onChange={(e) => setTr({ ...tr, to: e.target.value })}>
              {accounts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="مبلغ">
            <Input inputMode="numeric" value={tr.amount} onChange={(e) => setTr({ ...tr, amount: e.target.value })} />
          </Field>
          <DateField label="تاریخ" value={tr.date} onChange={(d) => setTr({ ...tr, date: d })} />
          <Button block onClick={saveTransfer}>انتقال</Button>
        </div>
      )}
      <p className="tiny" style={{ marginTop: 12 }}>سال مالی جاری: {jalaliYearOf()}</p>
      <Modal open={openAcc} title="حساب نقدی جدید" onClose={() => setOpenAcc(false)}>
        <Field label="نام">
          <Input value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} />
        </Field>
        <Field label="نوع">
          <Select value={acc.kind} onChange={(e) => setAcc({ ...acc, kind: e.target.value })}>
            <option value="cash">صندوق</option>
            <option value="bank">بانک</option>
            <option value="petty">تنخواه</option>
          </Select>
        </Field>
        <Field label="نام بانک">
          <Input value={acc.bank_name} onChange={(e) => setAcc({ ...acc, bank_name: e.target.value })} />
        </Field>
        <Field label="شبا">
          <Input value={acc.sheba} onChange={(e) => setAcc({ ...acc, sheba: e.target.value })} />
        </Field>
        <Field label="مانده اول دوره">
          <Input inputMode="numeric" value={acc.opening} onChange={(e) => setAcc({ ...acc, opening: e.target.value })} />
        </Field>
        <Button block onClick={saveAcc}>ذخیره</Button>
      </Modal>
    </div>
  )
}
