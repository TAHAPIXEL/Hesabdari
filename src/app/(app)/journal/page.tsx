'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRial } from '@/lib/money'
import { formatJalali } from '@/lib/jalali'
import { Spinner } from '@/components/ui'

type Entry = { id: string; number: string; entry_date: string; description: string | null; lines?: { debit: number; credit: number; account_code: string; description: string | null }[] }

export default function JournalPage() {
  const [rows, setRows] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    createClient()
      .from('journal_entries')
      .select('id,number,entry_date,description, lines:journal_lines(debit,credit,account_code,description)')
      .order('entry_date', { ascending: false })
      .limit(80)
      .then(({ data }) => {
        setRows((data || []) as Entry[])
        setLoading(false)
      })
  }, [])
  if (loading) return <Spinner />
  return (
    <div>
      <div className="topbar">
        <h1>اسناد حسابداری</h1>
      </div>
      {rows.map((e) => (
        <div key={e.id} className="card" style={{ marginBottom: 10 }}>
          <div className="row">
            <strong>{e.number}</strong>
            <span className="tiny">{formatJalali(e.entry_date)}</span>
          </div>
          <p className="tiny">{e.description}</p>
          {(e.lines || []).map((l, i) => (
            <div key={i} className="list-item">
              <span>
                {l.account_code} {l.description}
              </span>
              <span className="money">
                {Number(l.debit) ? `بدهکار ${formatRial(l.debit)}` : `بستانکار ${formatRial(l.credit)}`}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
