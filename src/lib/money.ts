import { toEnDigits, toFaDigits } from './jalali'

export function parseRial(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : 0
  if (!value) return 0
  const n = toEnDigits(String(value))
    .replace(/[٬,]/g, '')
    .replace(/[^\d.-]/g, '')
  if (!n || n === '-' || n === '.') return 0
  const num = Number(n)
  return Number.isFinite(num) ? Math.round(num) : 0
}

export function parseQty(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const n = toEnDigits(String(value)).replace(/[٬,]/g, '').replace(/[^\d.-]/g, '')
  const num = Number(n)
  return Number.isFinite(num) ? num : 0
}

export function formatRial(n: number | null | undefined, withUnit = true) {
  const v = Math.round(n || 0)
  const formatted = toFaDigits(v.toLocaleString('en-US'))
  return withUnit ? `${formatted} ریال` : formatted
}

export function formatQty(n: number | null | undefined) {
  const v = Number(n || 0)
  const s = Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000)
  return toFaDigits(s)
}

export function lineTotal(qty: number, unitPrice: number, discount = 0) {
  return Math.max(0, Math.round(qty * unitPrice) - Math.round(discount))
}
