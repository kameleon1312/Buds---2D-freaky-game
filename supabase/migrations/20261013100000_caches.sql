-- Opened caches (skrytki). The API validates the cache (packages/shared caches) and grants its coins and XP through
-- open_cache(), which records the opening, adds the XP and the coins in one transaction, exactly once per bud.
create table public.bud_caches (
  bud_id uuid not null references public.buds (id) on delete cascade,
  cache_id text not null check (cache_id ~ '^[a-z0-9-]{2,40}$'),
  coins integer not null check (coins >= 0),
  xp integer not null check (xp >= 0),
  opened_at timestamptz not null default now(),
  primary key (bud_id, cache_id)
);

alter table public.bud_caches enable row level security;

-- Returns {"xp": new xp, "coins": new coin balance}, or null if the cache was already opened (nothing changes then).
create function public.open_cache(p_bud uuid, p_cache text, p_coins integer, p_xp integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_xp integer;
  new_coins integer;
begin
  insert into public.bud_caches (bud_id, cache_id, coins, xp) values (p_bud, p_cache, p_coins, p_xp)
  on conflict (bud_id, cache_id) do nothing;
  if not found then
    return null;
  end if;
  update public.buds set xp = xp + p_xp where id = p_bud returning xp into new_xp;
  insert into public.bud_wallets (bud_id, coins) values (p_bud, p_coins)
  on conflict (bud_id) do update set coins = public.bud_wallets.coins + excluded.coins, updated_at = now()
  returning coins into new_coins;
  return jsonb_build_object('xp', new_xp, 'coins', new_coins);
end;
$$;

-- only the API (service role) may call it
revoke all on function public.open_cache(uuid, text, integer, integer) from public, anon, authenticated;
