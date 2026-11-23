/** Compact Jalali (Persian) calendar helpers. Dates in DB stay Gregorian ISO. */

function div(a: number, b: number) {
  return Math.trunc(a / b)
}

function g2d(gy: number, gm: number, gd: number) {
  const d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * ((gm + 9) % 12) + 2, 5) +
    gd -
    34840408
  return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
}

function d2g(jdn: number) {
  let j = 4 * jdn + 139361631
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div((j % 1461) / 4, 1) * 5 + 308
  const gd = div((i % 153) / 5, 1) + 1
  const gm = ((div(i, 153) % 12) + 1) as number
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6)
  return { gy, gm, gd }
}

function d2j(jdn: number) {
  const gy = d2g(jdn).gy
  let jy = gy - 621
  const r = jalCal(jy)
  const jdn1f = g2d(gy, 3, r.march)
  let k = jdn - jdn1f
  if (k >= 0) {
    if (k <= 185) {
      const jm = 1 + div(k, 31)
      const jd = (k % 31) + 1
      return { jy, jm, jd }
    }
    k -= 186
  } else {
    jy -= 1
    const r2 = jalCal(jy)
    k += 179
    if (r2.leap) k += 1
  }
  const jm = 7 + div(k, 30)
  const jd = (k % 30) + 1
  return { jy, jm, jd }
}

function jalCal(jy: number) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324,
    2394, 2456, 3178,
  ]
  const bl = breaks.length
  const gy = jy + 621
  let leapJ = -14
  let jp = breaks[0]
  let jump = 0
  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i]
    jump = jm - jp
    if (jy < jm) break
    leapJ += div(jump, 33) * 8 + div((jump % 33), 4)
    jp = jm
  }
  let n = jy - jp
  leapJ += div(n, 33) * 8 + div((n % 33) + 3, 4)
  if (jump % 33 === 4 && jump - n === 4) leapJ += 1
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
  let leap = (((n + 1) % 33) - 1) % 4
  if (leap === -1) leap = 4
  return { leap, gy, march }
}

function j2d(jy: number, jm: number, jd: number) {
  const r = jalCal(jy)
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
}

export function toJalali(gy: number, gm: number, gd: number) {
  return d2j(g2d(gy, gm, gd))
}

export function toGregorian(jy: number, jm: number, jd: number) {
  return d2g(j2d(jy, jm, jd))
}

export function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

export function tehranNow() {
  const s = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' })
  return new Date(s)
}

export function todayIso() {
  const d = tehranNow()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayJalali() {
  const d = tehranNow()
  return toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function isoToJalali(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return todayJalali()
  return toJalali(y, m, d)
}

export function jalaliToIso(jy: number, jm: number, jd: number) {
  const g = toGregorian(jy, jm, jd)
  return `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`
}

export function formatJalali(iso: string | null | undefined, digits: 'fa' | 'en' = 'fa') {
  if (!iso) return '—'
  const j = isoToJalali(iso)
  const s = `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`
  return digits === 'fa' ? toFaDigits(s) : s
}

export function formatJalaliLong(iso: string) {
  const j = isoToJalali(iso)
  const months = [
    'فروردین',
    'اردیبهشت',
    'خرداد',
    'تیر',
    'مرداد',
    'شهریور',
    'مهر',
    'آبان',
    'آذر',
    'دی',
    'بهمن',
    'اسفند',
  ]
  return toFaDigits(`${j.jd} ${months[j.jm - 1]} ${j.jy}`)
}

export function jalaliYearOf(iso?: string) {
  const j = iso ? isoToJalali(iso) : todayJalali()
  return j.jy
}

export function monthDays(jy: number, jm: number) {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  return jalCal(jy).leap === 1 ? 30 : 29
}

const FA = '۰۱۲۳۴۵۶۷۸۹'
const EN = '0123456789'

export function toFaDigits(s: string | number) {
  return String(s).replace(/\d/g, (d) => FA[Number(d)])
}

export function toEnDigits(s: string) {
  return s.replace(/[۰-۹]/g, (d) => EN[FA.indexOf(d)] ?? d)
}

export const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
