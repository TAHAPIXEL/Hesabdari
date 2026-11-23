-- Hesabdari — فروشگاه پلاسکو

create table if not exists public.company_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'فروشگاه پلاسکو',
  legal_name text,
  national_id text,
  economic_code text,
  phone text,
  address text,
  vat_percent numeric(5,2) not null default 0,
  allow_negative_stock boolean not null default false,
  setup_complete boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'فروشگاه',
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text not null check (type in ('asset','liability','equity','income','expense')),
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('cash','bank','petty')),
  account_code text,
  bank_name text,
  card_number text,
  sheba text,
  opening_balance numeric(18,0) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  barcode text,
  name text not null,
  kind text not null default 'goods' check (kind in ('goods','service')),
  category_id uuid references public.categories(id) on delete set null,
  unit text not null default 'عدد',
  variant text,
  buy_price numeric(18,0) not null default 0,
  sell_price numeric(18,0) not null default 0,
  stock numeric(18,3) not null default 0,
  min_stock numeric(18,3) not null default 0,
  vat_percent numeric(5,2),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'customer' check (kind in ('customer','supplier','both')),
  phone text,
  mobile text,
  national_id text,
  address text,
  opening_balance numeric(18,0) not null default 0,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  kind text not null check (kind in ('sale','purchase','sale_return','purchase_return')),
  party_id uuid references public.parties(id) on delete set null,
  cash_account_id uuid references public.cash_accounts(id) on delete set null,
  issued_at date not null default current_date,
  due_at date,
  status text not null default 'issued' check (status in ('draft','issued','paid','partial','cancelled')),
  subtotal numeric(18,0) not null default 0,
  discount numeric(18,0) not null default 0,
  vat numeric(18,0) not null default 0,
  total numeric(18,0) not null default 0,
  paid numeric(18,0) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  qty numeric(18,3) not null default 1,
  unit_price numeric(18,0) not null default 0,
  discount numeric(18,0) not null default 0,
  vat_percent numeric(5,2) not null default 0,
  cost_price numeric(18,0) not null default 0,
  total numeric(18,0) not null default 0
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('receive','pay')),
  party_id uuid references public.parties(id) on delete set null,
  cash_account_id uuid references public.cash_accounts(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric(18,0) not null,
  method text not null default 'cash' check (method in ('cash','card','credit','check','other')),
  paid_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('in','out')),
  party_id uuid references public.parties(id) on delete set null,
  cash_account_id uuid references public.cash_accounts(id) on delete set null,
  number text,
  bank_name text,
  amount numeric(18,0) not null,
  issued_at date,
  due_at date not null,
  status text not null default 'pending' check (status in ('pending','deposited','cleared','bounced','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(18,0) not null,
  spent_at date not null default current_date,
  cash_account_id uuid references public.cash_accounts(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_moves (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  qty numeric(18,3) not null,
  reason text not null,
  source_id uuid,
  moved_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.cash_ledger (
  id uuid primary key default gen_random_uuid(),
  cash_account_id uuid not null references public.cash_accounts(id) on delete restrict,
  amount numeric(18,0) not null,
  reason text not null,
  source_id uuid,
  occurred_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.cash_accounts(id),
  to_id uuid not null references public.cash_accounts(id),
  amount numeric(18,0) not null check (amount > 0),
  transferred_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  entry_date date not null default current_date,
  description text,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_code text not null,
  debit numeric(18,0) not null default 0,
  credit numeric(18,0) not null default 0,
  description text
);

create table if not exists public.doc_counters (
  kind text not null,
  jyear int not null,
  last_n int not null default 0,
  primary key (kind, jyear)
);

create index if not exists products_name_idx on public.products (name);
create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_sku_idx on public.products (sku);
create index if not exists invoices_issued_idx on public.invoices (issued_at desc);
create index if not exists invoices_kind_idx on public.invoices (kind, status);
create index if not exists parties_name_idx on public.parties (name);
create index if not exists checks_due_idx on public.checks (due_at);
create index if not exists stock_moves_prod_idx on public.stock_moves (product_id, moved_at desc);
create index if not exists cash_ledger_acc_idx on public.cash_ledger (cash_account_id, occurred_at desc);

create or replace function public.apply_stock_move()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.products set stock = stock + new.qty where id = new.product_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.products set stock = stock - old.qty where id = old.product_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_stock_move on public.stock_moves;
create trigger trg_stock_move after insert or delete on public.stock_moves
for each row execute function public.apply_stock_move();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, 'فروشگاه')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.company_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.cash_accounts enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.parties enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.checks enable row level security;
alter table public.expenses enable row level security;
alter table public.stock_moves enable row level security;
alter table public.cash_ledger enable row level security;
alter table public.transfers enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.doc_counters enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'company_settings','profiles','accounts','cash_accounts','categories','products','parties',
    'invoices','invoice_items','payments','checks','expenses','stock_moves','cash_ledger',
    'transfers','journal_entries','journal_lines','doc_counters'
  ] loop
    execute format('drop policy if exists auth_all on public.%I', t);
    execute format('drop policy if exists public_all on public.%I', t);
    execute format('create policy public_all on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
