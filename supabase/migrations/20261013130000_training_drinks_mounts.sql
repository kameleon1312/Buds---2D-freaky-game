-- Skill training on the map, energy drinks (napoje) and mounts (wierzchowce). Everything is written by the API
-- (service role) only; clients never get policies.

-- Mounts are worn in their own slot (packages/shared gear.ts).
alter table public.bud_equipment drop constraint bud_equipment_slot_check;
alter table public.bud_equipment
  add constraint bud_equipment_slot_check
  check (slot in ('head', 'face', 'torso', 'hands', 'legs', 'feet', 'accessory', 'held', 'mount'));

-- Training XP per skill (every 100 XP adds a rank on top of the spent skill points; packages/shared skills.ts).
create table public.bud_training (
  bud_id uuid not null references public.buds (id) on delete cascade,
  skill_id text not null check (skill_id ~ '^[a-z0-9-]{2,40}$'),
  xp integer not null default 0 check (xp >= 0),
  primary key (bud_id, skill_id)
);

alter table public.bud_training enable row level security;

-- When a bud last trained at a spot (cooldown per spot).
create table public.bud_training_spots (
  bud_id uuid not null references public.buds (id) on delete cascade,
  spot_id text not null check (spot_id ~ '^[a-z0-9-]{2,40}$'),
  last_at timestamptz not null default now(),
  primary key (bud_id, spot_id)
);

alter table public.bud_training_spots enable row level security;

-- Energy drinks a bud carries (a count per drink).
create table public.bud_consumables (
  bud_id uuid not null references public.buds (id) on delete cascade,
  item_id text not null check (item_id ~ '^[a-z0-9-]{3,40}$'),
  qty integer not null default 0 check (qty >= 0),
  primary key (bud_id, item_id)
);

alter table public.bud_consumables enable row level security;

-- Boosts from drunk drinks, active until `until`.
create table public.bud_buffs (
  bud_id uuid not null references public.buds (id) on delete cascade,
  buff_id text not null check (buff_id ~ '^[a-z0-9-]{2,40}$'),
  until timestamptz not null,
  primary key (bud_id, buff_id)
);

alter table public.bud_buffs enable row level security;

-- One training round: checks the spot's cooldown and adds XP in one transaction.
-- Returns the skill's new training XP, or null while the spot is cooling down.
create function public.train(p_bud uuid, p_spot text, p_skill text, p_xp integer, p_cooldown integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  total integer;
begin
  insert into public.bud_training_spots (bud_id, spot_id, last_at) values (p_bud, p_spot, now())
  on conflict (bud_id, spot_id) do update set last_at = now()
  where public.bud_training_spots.last_at <= now() - make_interval(secs => p_cooldown);
  if not found then
    return null;
  end if;
  insert into public.bud_training (bud_id, skill_id, xp) values (p_bud, p_skill, greatest(p_xp, 0))
  on conflict (bud_id, skill_id) do update set xp = public.bud_training.xp + excluded.xp
  returning xp into total;
  return total;
end;
$$;

revoke all on function public.train(uuid, text, text, integer, integer) from public, anon, authenticated;

-- Buys one drink for coins: {"status": "ok"|"poor", "coins": balance}. Drinks can be bought again and again.
create function public.buy_consumable(p_bud uuid, p_item text, p_price integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  balance integer;
begin
  insert into public.bud_wallets (bud_id) values (p_bud) on conflict (bud_id) do nothing;
  select coins into balance from public.bud_wallets where bud_id = p_bud for update;
  if balance < p_price then
    return jsonb_build_object('status', 'poor', 'coins', balance);
  end if;
  update public.bud_wallets set coins = coins - p_price, updated_at = now()
  where bud_id = p_bud returning coins into balance;
  insert into public.bud_consumables (bud_id, item_id, qty) values (p_bud, p_item, 1)
  on conflict (bud_id, item_id) do update set qty = public.bud_consumables.qty + 1;
  return jsonb_build_object('status', 'ok', 'coins', balance);
end;
$$;

revoke all on function public.buy_consumable(uuid, text, integer) from public, anon, authenticated;

-- Gives drinks (duel loot).
create function public.grant_consumable(p_bud uuid, p_item text, p_qty integer)
returns integer
language sql
security invoker
set search_path = public
as $$
  insert into public.bud_consumables (bud_id, item_id, qty) values (p_bud, p_item, greatest(p_qty, 0))
  on conflict (bud_id, item_id) do update set qty = public.bud_consumables.qty + excluded.qty
  returning qty;
$$;

revoke all on function public.grant_consumable(uuid, text, integer) from public, anon, authenticated;

-- Drinks one: takes it from the count and starts (or restarts) its boost. Returns the boost's end, or null when
-- the bud has none left.
create function public.use_consumable(p_bud uuid, p_item text, p_buff text, p_seconds integer)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  ends timestamptz := now() + make_interval(secs => p_seconds);
begin
  update public.bud_consumables set qty = qty - 1
  where bud_id = p_bud and item_id = p_item and qty > 0;
  if not found then
    return null;
  end if;
  insert into public.bud_buffs (bud_id, buff_id, until) values (p_bud, p_buff, ends)
  on conflict (bud_id, buff_id) do update set until = excluded.until;
  return ends;
end;
$$;

revoke all on function public.use_consumable(uuid, text, text, integer) from public, anon, authenticated;
