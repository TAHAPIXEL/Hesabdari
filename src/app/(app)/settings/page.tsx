'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button, CopyBtn, Field, Input } from '@/components/ui'
import { useToast } from '@/components/Toast'

export default function SettingsPage() {
  const toast = useToast()
  const [form, setForm] = useState({
    name: 'فروشگاه پلاسکو',
    legal_name: '',
    national_id: '',
    economic_code: '',
    phone: '',
    address: '',
    vat_percent: '0',
    allow_negative_stock: false,
  })
  useEffect(() => {
    createClient()
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setForm({
          name: data.name || '',
          legal_name: data.legal_name || '',
          national_id: data.national_id || '',
          economic_code: data.economic_code || '',
          phone: data.phone || '',
          address: data.address || '',
          vat_percent: String(data.vat_percent ?? 0),
          allow_negative_stock: !!data.allow_negative_stock,
        })
      })
  }, [])

  async function save() {
    const { error } = await createClient()
      .from('company_settings')
      .update({
        name: form.name.trim() || 'فروشگاه پلاسکو',
        legal_name: form.legal_name || null,
        national_id: form.national_id || null,
        economic_code: form.economic_code || null,
        phone: form.phone || null,
        address: form.address || null,
        vat_percent: Number(form.vat_percent) || 0,
        allow_negative_stock: form.allow_negative_stock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    if (error) return toast.push(error.message, 'err')
    toast.push('تنظیمات ذخیره شد. نام فروشگاه در فاکتور و بالای سایت عوض می‌شود.')
  }

  return (
    <div>
      <div className="topbar">
        <h1>تنظیمات</h1>
      </div>
      <div className="card">
        <h3>مشخصات فروشگاه</h3>
        <p className="tiny">نام را هر وقت خواستی عوض کن؛ روی فاکتور و عنوان سامانه می‌آید.</p>
        <Field label="نام فروشگاه">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="نام حقوقی">
          <Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
        </Field>
        <Field label="شناسه ملی">
          <div className="money-line">
            <Input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
            {form.national_id ? <CopyBtn text={form.national_id} /> : null}
          </div>
        </Field>
        <Field label="کد اقتصادی">
          <div className="money-line">
            <Input value={form.economic_code} onChange={(e) => setForm({ ...form, economic_code: e.target.value })} />
            {form.economic_code ? <CopyBtn text={form.economic_code} /> : null}
          </div>
        </Field>
        <Field label="تلفن">
          <div className="money-line">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            {form.phone ? <CopyBtn text={form.phone} /> : null}
          </div>
        </Field>
        <Field label="آدرس">
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Field label="درصد مالیات ارزش افزوده">
          <Input inputMode="decimal" value={form.vat_percent} onChange={(e) => setForm({ ...form, vat_percent: e.target.value })} />
        </Field>
        <label className="tiny" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={form.allow_negative_stock}
            onChange={(e) => setForm({ ...form, allow_negative_stock: e.target.checked })}
          />
          اجازه فروش با موجودی منفی
        </label>
        <Button block onClick={save}>
          ذخیره مشخصات
        </Button>
      </div>
    </div>
  )
}
