import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim()
    const password = String(body.password || '')
    const shopName = String(body.shopName || 'فروشگاه پلاسکو').trim()
    const openingCash = Number(body.openingCash || 0)

    if (!email || !password || password.length < 8) {
      return NextResponse.json({ error: 'ایمیل و رمز معتبر لازم است.' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: existing } = await admin.from('company_settings').select('setup_complete').eq('id', 1).maybeSingle()
    if (existing?.setup_complete) {
      return NextResponse.json({ error: 'راه‌اندازی قبلاً انجام شده است.' }, { status: 400 })
    }

    const { data: created, error: userErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (userErr || !created.user) {
      return NextResponse.json({ error: userErr?.message || 'ساخت حساب انجام نشد.' }, { status: 400 })
    }

    await admin.from('profiles').upsert({ id: created.user.id, full_name: 'فروشگاه' })
    const { error: seedErr } = await admin.rpc('seed_defaults', {
      p_shop_name: shopName,
      p_opening_cash: Number.isFinite(openingCash) ? Math.round(openingCash) : 0,
    })
    if (seedErr) {
      return NextResponse.json({ error: seedErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'خطای غیرمنتظره در راه‌اندازی.' }, { status: 500 })
  }
}
