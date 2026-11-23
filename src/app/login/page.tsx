'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Field, Input } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('is_setup').then(({ data }) => {
      if (!data) router.replace('/setup')
      else setReady(true)
    })
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) setErr('ایمیل یا رمز عبور نادرست است.')
    else router.replace('/dashboard')
  }

  if (!ready) return <div className="auth-wrap" />

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="brand-mark">پ</div>
        <h1>ورود همکاران</h1>
        <p className="muted">حساب مشترک فروشگاه پلاسکو — همه دسترسی کامل دارند.</p>
        <div style={{ height: 16 }} />
        <Field label="ایمیل">
          <Input type="email" inputMode="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="رمز عبور">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {err ? <p className="tiny" style={{ color: 'var(--danger)' }}>{err}</p> : null}
        <Button block disabled={loading} type="submit">
          {loading ? 'در حال ورود…' : 'ورود به سامانه'}
        </Button>
      </form>
    </div>
  )
}
