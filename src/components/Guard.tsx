'use client'

import { useEffect, type ReactNode } from 'react'

export function Guard({ children }: { children: ReactNode }) {
  useEffect(() => {
    const allow = (el: EventTarget | null) => {
      const n = el as HTMLElement | null
      return !!n?.closest?.('input, textarea, select')
    }
    const ctx = (e: Event) => {
      e.preventDefault()
    }
    const sel = (e: Event) => {
      if (!allow(e.target)) e.preventDefault()
    }
    const copy = (e: ClipboardEvent) => {
      if (!allow(e.target)) e.preventDefault()
    }
    const drag = (e: Event) => e.preventDefault()
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'a', 'u', 's'].includes(e.key.toLowerCase())) {
        if (!allow(e.target)) e.preventDefault()
      }
      if (e.key === 'F12') e.preventDefault()
    }
    document.addEventListener('contextmenu', ctx)
    document.addEventListener('selectstart', sel)
    document.addEventListener('copy', copy)
    document.addEventListener('cut', copy)
    document.addEventListener('dragstart', drag)
    document.addEventListener('keydown', keys)
    return () => {
      document.removeEventListener('contextmenu', ctx)
      document.removeEventListener('selectstart', sel)
      document.removeEventListener('copy', copy)
      document.removeEventListener('cut', copy)
      document.removeEventListener('dragstart', drag)
      document.removeEventListener('keydown', keys)
    }
  }, [])
  return <>{children}</>
}
