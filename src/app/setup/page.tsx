'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Field, Input } from '@/components/ui'
import { parseRial } from '@/lib/money'

export default function SetupPage() {
  const router = useRouter()
  const [shopName, setShopName] = useState('فروشگاه پلاسکو')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [opening, setOpening] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('is_setup').then(({ data }) => {
      if (data) router.replace('/login')
      else setReady(true)
    })
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (password.length < 8) return setErr('رمز عبور حداقل ۸ کاراکتر باشد.')
    if (password !== password2) return setErr('تکرار رمز با رمز عبور یکی نیست.')
    setLoading(true)
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        password,
        shopName: shopName.trim() || 'فروشگاه پلاسکو',
        openingCash: parseRial(opening),
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setLoading(false)
      setErr(json.error || 'راه‌اندازی انجام نشد.')
      return
    }
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) router.replace('/login')
    else router.replace('/dashboard')
  }

  if (!ready) return <div className="auth-wrap" />

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="brand-mark">پ</div>
        <h1>راه‌اندازی اولیه</h1>
        <p className="muted">یک حساب مشترک برای همه همکاران ساخته می‌شود. نام فروشگاه را بعداً از تنظیمات عوض می‌کنید.</p>
        <div style={{ height: 16 }} />
        <Field label="نام فروشگاه">
          <Input value={shopName} onChange={(e) => setShopName(e.target.value)} required />
        </Field>
        <Field label="ایمیل حساب مشترک">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="رمز عبور">
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="تکرار رمز عبور">
          <Input type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} />
        </Field>
        <Field label="موجودی اول دوره صندوق (ریال)">
          <Input inputMode="numeric" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="۰" />
        </Field>
        {err ? <p className="tiny" style={{ color: 'var(--danger)' }}>{err}</p> : null}
        <Button block disabled={loading} type="submit">
          {loading ? 'در حال ساخت…' : 'شروع کار فروشگاه'}
        </Button>
      </form>
    </div>
  )
}
