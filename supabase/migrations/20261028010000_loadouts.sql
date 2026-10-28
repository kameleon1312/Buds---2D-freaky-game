-- Ciosy (docs/walka.md): every bud puts its own five fight buttons together, one loadout per weapon kind, and
-- upgrades its moves three times each for coins earned in the game (packages/shared/src/loadout.ts: what fits, what is
-- open, the prices). The API checks every loadout; it is checked again when the fighter is built. Only the API
-- touches these tables (RLS on, no policies).

create table public.bud_loadouts (
  bud_id uuid not null references public.buds (id) on delete cascade,
  weapon text not null check (weapon ~ '^[a-z]{3,20}$'),
  -- five ability ids (or null for an empty ultimate), in button order
  kit jsonb not null check (jsonb_typeof(kit) = 'array' and jsonb_array_length(kit) = 5),
  updated_at timestamptz not null default now(),
  primary key (bud_id, weapon)
);

alter table public.bud_loadouts enable row level security;

create table public.bud_move_ranks (
  bud_id uuid not null references public.buds (id) on delete cascade,
  move_id text not null check (move_id ~ '^[a-z0-9-]{2,30}$'),
  rank integer not null default 0 check (rank between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (bud_id, move_id)
);

alter table public.bud_move_ranks enable row level security;

-- One upgrade of a move from rank p_from, paying p_price coins, in one transaction: the rank must still be p_from (a
-- second tap or another device can't pay twice) and the coins must be there.
-- {"status": "ok" | "race" | "poor", "coins": balance, "rank": the rank now}
create function public.upgrade_move(p_bud uuid, p_move text, p_from integer, p_price integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  balance integer;
  current integer;
begin
  insert into public.bud_wallets (bud_id) values (p_bud) on conflict (bud_id) do nothing;
  select coins into balance from public.bud_wallets where bud_id = p_bud for update;
  insert into public.bud_move_ranks (bud_id, move_id) values (p_bud, p_move) on conflict (bud_id, move_id) do nothing;
  select rank into current from public.bud_move_ranks where bud_id = p_bud and move_id = p_move for update;
  if current <> p_from or current >= 3 then
    return jsonb_build_object('status', 'race', 'coins', balance, 'rank', current);
  end if;
  if balance < p_price then
    return jsonb_build_object('status', 'poor', 'coins', balance, 'rank', current);
  end if;
  update public.bud_wallets set coins = coins - greatest(p_price, 0), updated_at = now()
  where bud_id = p_bud returning coins into balance;
  update public.bud_move_ranks set rank = current + 1, updated_at = now()
  where bud_id = p_bud and move_id = p_move;
  return jsonb_build_object('status', 'ok', 'coins', balance, 'rank', current + 1);
end;
$$;

revoke all on function public.upgrade_move(uuid, text, integer, integer) from public, anon, authenticated;
