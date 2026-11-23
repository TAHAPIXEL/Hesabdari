'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Kind = 'ok' | 'err'
type Toast = { id: number; text: string; kind: Kind }

const Ctx = createContext<{ push: (text: string, kind?: Kind) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: Kind = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s.slice(-3), { id, text, kind }])
    window.setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3400)
  }, [])
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const c = useContext(Ctx)
  return c || { push: () => undefined }
}
