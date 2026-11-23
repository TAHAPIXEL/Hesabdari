'use client'

import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { WEEKDAYS, formatJalali, isoToJalali, jalaliToIso, monthDays, pad2, todayIso, todayJalali, toFaDigits } from '@/lib/jalali'
import { formatRial } from '@/lib/money'
import { useToast } from './Toast'

export function Button({
  variant = 'primary',
  block,
  small,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft' | 'gold' | 'danger'; block?: boolean; small?: boolean }) {
  const v = variant === 'primary' ? '' : ` btn-${variant}`
  return <button className={`btn${v}${block ? ' btn-block' : ''}${small ? ' btn-sm' : ''} ${className}`} {...props} />
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="select" {...props} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input" {...props} />
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} type="button" aria-label="بستن">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  )
}

export function Spinner() {
  return <div className="spinner" />
}

export function Badge({ children, kind = 'default' }: { children: ReactNode; kind?: 'default' | 'ok' | 'warn' | 'danger' | 'gold' }) {
  return <span className={`badge ${kind === 'default' ? '' : kind}`}>{children}</span>
}

export function Seg({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { id: string; label: string }[]
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function DateField({ value, onChange, label }: { value: string; onChange: (iso: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const j = useMemo(() => (value ? isoToJalali(value) : todayJalali()), [value])
  const [cursor, setCursor] = useState({ y: j.jy, m: j.jm })
  useEffect(() => setCursor({ y: j.jy, m: j.jm }), [j.jy, j.jm])
  const days = monthDays(cursor.y, cursor.m)
  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
  const inner = (
    <div>
      <button type="button" className="input" style={{ textAlign: 'right' }} onClick={() => setOpen((s) => !s)}>
        {formatJalali(value)}
      </button>
      {open ? (
        <div className="cal" style={{ marginTop: 8 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <button type="button" className="icon-btn" onClick={() => setCursor((c) => (c.m === 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m: c.m + 1 }))}>
              ‹
            </button>
            <strong>
              {months[cursor.m - 1]} {toFaDigits(cursor.y)}
            </strong>
            <button type="button" className="icon-btn" onClick={() => setCursor((c) => (c.m === 1 ? { y: c.y - 1, m: 12 } : { y: c.y, m: c.m - 1 }))}>
              ›
            </button>
          </div>
          <div className="cal-grid">
            {WEEKDAYS.map((w) => (
              <div key={w} className="tiny">
                {w}
              </div>
            ))}
            {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
              const on = j.jy === cursor.y && j.jm === cursor.m && j.jd === d
              return (
                <button
                  key={d}
                  type="button"
                  className={on ? 'on' : ''}
                  onClick={() => {
                    onChange(jalaliToIso(cursor.y, cursor.m, d))
                    setOpen(false)
                  }}
                >
                  {toFaDigits(pad2(d))}
                </button>
              )
            })}
          </div>
          <Button
            small
            variant="ghost"
            type="button"
            style={{ marginTop: 8 }}
            onClick={() => {
              onChange(todayIso())
              setOpen(false)
            }}
          >
            امروز
          </Button>
        </div>
      ) : null}
    </div>
  )
  if (!label) return inner
  return <Field label={label}>{inner}</Field>
}

export function CopyBtn({ text }: { text: string }) {
  const toast = useToast()
  return (
    <button
      type="button"
      className="copy-btn no-print"
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(text)
          toast.push('کپی شد')
        } catch {
          toast.push('کپی نشد', 'err')
        }
      }}
    >
      کپی
    </button>
  )
}

export function Money({ n, copy = true }: { n: number; copy?: boolean }) {
  return (
    <span className="money-line">
      <span className="money">{formatRial(n)}</span>
      {copy ? <CopyBtn text={String(Math.round(n || 0))} /> : null}
    </span>
  )
}

export function CopyText({ value }: { value: string }) {
  return (
    <span className="money-line">
      <span>{value}</span>
      <CopyBtn text={value} />
    </span>
  )
}

export function statusFa(s: string) {
  const map: Record<string, string> = {
    issued: 'ثبت‌شده',
    paid: 'تسویه‌شده',
    partial: 'کسری',
    cancelled: 'باطل',
    draft: 'پیش‌نویس',
    pending: 'نزد صندوق',
    deposited: 'خوابانده',
    cleared: 'پاس‌شده',
    bounced: 'برگشتی',
  }
  return map[s] || s
}

export function statusKind(s: string): 'ok' | 'warn' | 'danger' | 'gold' | 'default' {
  if (s === 'paid' || s === 'cleared') return 'ok'
  if (s === 'partial' || s === 'pending' || s === 'deposited') return 'warn'
  if (s === 'cancelled' || s === 'bounced') return 'danger'
  if (s === 'issued') return 'gold'
  return 'default'
}
