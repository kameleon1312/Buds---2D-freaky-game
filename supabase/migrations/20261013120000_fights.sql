-- Duels (pojedynki). The API resolves every turn (packages/shared combat.ts) and keeps the fight state here, so the
-- game only animates what the server decided. Written by the API (service role) only; clients get no policies.
create table public.bud_fights (
  id uuid primary key default gen_random_uuid(),
  bud_id uuid not null references public.buds (id) on delete cascade,
  enemy_id text not null check (enemy_id ~ '^[a-z0-9-]{2,40}$'),
  status text not null default 'active' check (status in ('active', 'won', 'lost', 'fled')),
  turn integer not null default 0 check (turn >= 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index bud_fights_bud_idx on public.bud_fights (bud_id, enemy_id, finished_at desc);

alter table public.bud_fights enable row level security;

-- Ends an active fight exactly once: saves the last state, the result and grants XP and coins in one transaction.
-- Returns {"xp": new xp, "coins": new balance}, or null when the fight was not active at that turn (a retry or a race).
create function public.finish_fight(
  p_fight uuid,
  p_bud uuid,
  p_turn integer,
  p_state jsonb,
  p_status text,
  p_xp integer,
  p_coins integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_xp integer;
  new_coins integer;
begin
  update public.bud_fights
  set status = p_status, state = p_state, turn = p_turn + 1, finished_at = now()
  where id = p_fight and bud_id = p_bud and status = 'active' and turn = p_turn;
  if not found then
    return null;
  end if;
  update public.buds set xp = xp + greatest(p_xp, 0) where id = p_bud returning xp into new_xp;
  insert into public.bud_wallets (bud_id, coins) values (p_bud, greatest(p_coins, 0))
  on conflict (bud_id) do update set coins = public.bud_wallets.coins + excluded.coins, updated_at = now()
  returning coins into new_coins;
  return jsonb_build_object('xp', new_xp, 'coins', new_coins);
end;
$$;

revoke all on function public.finish_fight(uuid, uuid, integer, jsonb, text, integer, integer)
  from public, anon, authenticated;
