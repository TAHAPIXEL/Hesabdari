import { createClient } from './supabase/client'
import type { Product } from './types'

function safe(s: string) {
  return s.trim().replace(/[%_,()]/g, '')
}

export async function searchProducts(q: string, limit = 24): Promise<Product[]> {
  const query = safe(q)
  if (!query) return []
  const { data } = await createClient()
    .from('products')
    .select('*')
    .eq('is_active', true)
    .or(`name.ilike.%${query}%,barcode.eq.${query},sku.eq.${query},variant.ilike.%${query}%`)
    .limit(limit)
  return (data || []) as Product[]
}

export async function findByBarcode(code: string): Promise<Product[]> {
  const c = safe(code)
  if (!c) return []
  const supabase = createClient()
  const { data } = await supabase.from('products').select('*').or(`barcode.eq.${c},sku.eq.${c}`).limit(8)
  if (data?.length) return data as Product[]
  const stripped = c.replace(/^0+/, '')
  if (stripped && stripped !== c) {
    const { data: d2 } = await supabase.from('products').select('*').or(`barcode.eq.${stripped},sku.eq.${stripped}`).limit(8)
    if (d2?.length) return d2 as Product[]
  }
  const { data: d3 } = await supabase.from('products').select('*').eq('is_active', true).ilike('barcode', `%${c}%`).limit(5)
  return (d3 || []) as Product[]
}
