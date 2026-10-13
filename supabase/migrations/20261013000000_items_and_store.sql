-- Groundwork for monetisation: owned items, currencies and store receipts.
-- Everything here is written by the API (service role) only; clients never get policies.

-- Items a bud owns beyond the free starter set. item_id refers to the catalog in packages/shared (catalog.ts).
create table public.bud_items (
  bud_id uuid not null references public.buds (id) on delete cascade,
  item_id text not null check (item_id ~ '^[a-z0-9-]{3,40}$'),
  source text not null check (source in ('reward', 'purchase', 'gift', 'promo')),
  acquired_at timestamptz not null default now(),
  primary key (bud_id, item_id)
);

-- Balances: coins are earned in the game (server-granted), gems are bought in the store.
create table public.bud_wallets (
  bud_id uuid primary key references public.buds (id) on delete cascade,
  coins integer not null default 0 check (coins >= 0),
  gems integer not null default 0 check (gems >= 0),
  updated_at timestamptz not null default now()
);

-- Store receipts (App Store, Google Play, web). A purchase is granted only after the API verifies the
-- receipt with the store; the unique transaction id makes the grant idempotent (no double spending on retries).
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  bud_id uuid not null references public.buds (id) on delete cascade,
  platform text not null check (platform in ('apple', 'google', 'web')),
  product_id text not null check (char_length(product_id) between 1 and 100),
  transaction_id text not null check (char_length(transaction_id) between 1 and 200),
  status text not null default 'pending' check (status in ('pending', 'verified', 'refunded', 'rejected')),
  created_at timestamptz not null default now(),
  unique (platform, transaction_id)
);

create index purchases_bud_idx on public.purchases (bud_id, created_at desc);

alter table public.bud_items enable row level security;
alter table public.bud_wallets enable row level security;
alter table public.purchases enable row level security;
