-- Player characters. Accessed only through the API (service role); anon/authenticated get no policies.
create table public.buds (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 2 and 16),
  -- validated by the API (budLookSchema); jsonb so new cosmetics need no migration
  look jsonb not null check (jsonb_typeof(look) = 'object'),
  xp integer not null default 0 check (xp >= 0),
  -- set when a guest later links a real account
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index buds_leaderboard_idx on public.buds (xp desc, created_at asc);

-- Guest credentials: one per device (browser, phone). Only sha256(token) is stored.
create table public.bud_tokens (
  token_hash text primary key check (char_length(token_hash) = 64),
  bud_id uuid not null references public.buds (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index bud_tokens_bud_idx on public.bud_tokens (bud_id);

-- Short-lived codes that link a new device (e.g. the mobile game) to an existing bud.
create table public.bud_pair_codes (
  code text primary key check (code ~ '^[A-Z2-9]{6}$'),
  bud_id uuid not null references public.buds (id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.buds enable row level security;
alter table public.bud_tokens enable row level security;
alter table public.bud_pair_codes enable row level security;
