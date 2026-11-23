export type CashKind = 'cash' | 'bank' | 'petty'
export type PartyKind = 'customer' | 'supplier' | 'both'
export type ProductKind = 'goods' | 'service'
export type InvoiceKind = 'sale' | 'purchase' | 'sale_return' | 'purchase_return'
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partial' | 'cancelled'
export type PayMethod = 'cash' | 'card' | 'credit' | 'check'
export type CheckDirection = 'in' | 'out'
export type CheckStatus = 'pending' | 'deposited' | 'cleared' | 'bounced' | 'cancelled'

export type Company = {
  id: number
  name: string
  legal_name: string | null
  national_id: string | null
  economic_code: string | null
  phone: string | null
  address: string | null
  vat_percent: number
  allow_negative_stock: boolean
  setup_complete: boolean
}

export type CashAccount = {
  id: string
  name: string
  kind: CashKind
  bank_name: string | null
  card_number: string | null
  sheba: string | null
  opening_balance: number
  is_active: boolean
  balance?: number
}

export type Category = { id: string; name: string }

export type Product = {
  id: string
  sku: string | null
  barcode: string | null
  name: string
  kind: ProductKind
  category_id: string | null
  unit: string
  variant: string | null
  buy_price: number
  sell_price: number
  stock: number
  min_stock: number
  vat_percent: number | null
  description: string | null
  is_active: boolean
}

export type Party = {
  id: string
  name: string
  kind: PartyKind
  phone: string | null
  mobile: string | null
  national_id: string | null
  address: string | null
  opening_balance: number
  notes: string | null
  is_active: boolean
  balance?: number
}

export type Invoice = {
  id: string
  number: string
  kind: InvoiceKind
  party_id: string | null
  cash_account_id: string | null
  issued_at: string
  due_at: string | null
  status: InvoiceStatus
  subtotal: number
  discount: number
  vat: number
  total: number
  paid: number
  notes: string | null
  party?: Party | null
  items?: InvoiceItem[]
}

export type InvoiceItem = {
  id: string
  invoice_id: string
  product_id: string | null
  description: string
  qty: number
  unit_price: number
  discount: number
  vat_percent: number
  cost_price: number
  total: number
  product?: Product | null
}

export type CartLine = {
  key: string
  product_id: string | null
  description: string
  unit: string
  qty: number
  unit_price: number
  discount: number
  vat_percent: number
  cost_price: number
  stock: number
  kind: ProductKind
}

export type CheckRow = {
  id: string
  direction: CheckDirection
  party_id: string | null
  cash_account_id: string | null
  number: string | null
  bank_name: string | null
  amount: number
  issued_at: string | null
  due_at: string
  status: CheckStatus
  notes: string | null
  party?: Party | null
}

export type Expense = {
  id: string
  title: string
  amount: number
  spent_at: string
  cash_account_id: string | null
  notes: string | null
}

export type DashboardStats = {
  today_sales: number
  today_count: number
  month_sales: number
  month_profit: number
  cash_total: number
  bank_total: number
  receivables: number
  payables: number
  low_stock: number
  pending_checks_in: number
  pending_checks_out: number
}

export type StockMove = {
  id: string
  product_id: string
  qty: number
  reason: string
  moved_at: string
  notes: string | null
  product?: Product | null
}
