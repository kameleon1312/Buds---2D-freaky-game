-- Dystrykty (docs/dystrykty.md): plots on the wastelands between the cities, bought for coins; on each one a bud's
-- district under the name it chose. A district's whole state (name, stage, buildings, resources, raid log) is one
-- document worked out by the API with packages/shared land.ts: production is counted lazily from timestamps, never
-- sent by the game. Every change is a compare-and-swap on `version`; coins (the plot, rent, sales, growing) move in
-- the same transaction, never below zero; a raid saves both districts at once. Only the API touches it.

create table public.bud_lands (
  bud_id uuid primary key references public.buds (id) on delete cascade,
  -- the plot (land.ts PLOTS) and the wasteland it is on; one district per plot
  plot text not null unique check (plot ~ '^[a-z0-9-]{3,40}$'),
  route text not null check (route ~ '^[a-z-]{3,40}$'),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  version integer not null default 0 check (version >= 0),
  -- the district's might (land.ts landPower), kept beside the document for the rankings
  power integer not null default 0 check (power >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bud_lands enable row level security;
-- no policies: the service role (the API) is the only reader and writer

create index bud_lands_power_idx on public.bud_lands (power desc);
create index bud_lands_route_idx on public.bud_lands (route);

-- Buys a plot and makes the bud's district on it, paying p_price coins.
-- {"status": "ok" | "has_land" | "taken" | "poor", "coins": balance}
create function public.create_land(
  p_bud uuid,
  p_plot text,
  p_route text,
  p_state jsonb,
  p_power integer,
  p_price integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  balance integer;
begin
  insert into public.bud_wallets (bud_id) values (p_bud) on conflict (bud_id) do nothing;
  -- the wallet row first: two purchases of one bud wait for each other here
  select coins into balance from public.bud_wallets where bud_id = p_bud for update;
  if exists (select 1 from public.bud_lands where bud_id = p_bud) then
    return jsonb_build_object('status', 'has_land', 'coins', balance);
  end if;
  if balance < greatest(p_price, 0) then
    return jsonb_build_object('status', 'poor', 'coins', balance);
  end if;
  begin
    insert into public.bud_lands (bud_id, plot, route, state, power)
    values (p_bud, p_plot, p_route, p_state, greatest(p_power, 0));
  exception when unique_violation then
    -- someone else bought the plot first
    return jsonb_build_object('status', 'taken', 'coins', balance);
  end;
  update public.bud_wallets set coins = coins - greatest(p_price, 0), updated_at = now()
  where bud_id = p_bud returning coins into balance;
  return jsonb_build_object('status', 'ok', 'coins', balance);
end;
$$;

-- Saves a district the API worked out from version p_version, moving p_coins (negative = paid) with it.
-- {"status": "ok", "version": n, "coins": balance} | {"status": "conflict"} (someone saved first: work it out again)
-- | {"status": "poor", "coins": balance} (not enough coins).
create function public.save_land(p_bud uuid, p_version integer, p_state jsonb, p_power integer, p_coins integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  balance integer;
begin
  insert into public.bud_wallets (bud_id) values (p_bud) on conflict (bud_id) do nothing;
  -- the wallet row first: two saves of one bud wait for each other here
  select coins into balance from public.bud_wallets where bud_id = p_bud for update;
  if balance + p_coins < 0 then
    return jsonb_build_object('status', 'poor', 'coins', balance);
  end if;
  update public.bud_lands
  set state = p_state, power = greatest(p_power, 0), version = version + 1, updated_at = now()
  where bud_id = p_bud and version = p_version;
  if not found then
    return jsonb_build_object('status', 'conflict', 'coins', balance);
  end if;
  if p_coins <> 0 then
    update public.bud_wallets set coins = coins + p_coins, updated_at = now()
    where bud_id = p_bud returning coins into balance;
  end if;
  return jsonb_build_object('status', 'ok', 'version', p_version + 1, 'coins', balance);
end;
$$;

-- Saves both districts of a raid, or neither: 'ok', or 'conflict' when either was saved meanwhile.
create function public.save_raid(
  p_raider uuid,
  p_raider_version integer,
  p_raider_state jsonb,
  p_raider_power integer,
  p_defender uuid,
  p_defender_version integer,
  p_defender_state jsonb,
  p_defender_power integer
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  rv integer;
  dv integer;
begin
  -- both rows locked in one order (by id), so two raids between the same districts can't deadlock
  perform 1 from public.bud_lands where bud_id in (p_raider, p_defender) order by bud_id for update;
  select version into rv from public.bud_lands where bud_id = p_raider;
  select version into dv from public.bud_lands where bud_id = p_defender;
  if rv is distinct from p_raider_version or dv is distinct from p_defender_version then
    return 'conflict';
  end if;
  update public.bud_lands
  set state = p_raider_state, power = greatest(p_raider_power, 0), version = version + 1, updated_at = now()
  where bud_id = p_raider;
  update public.bud_lands
  set state = p_defender_state, power = greatest(p_defender_power, 0), version = version + 1, updated_at = now()
  where bud_id = p_defender;
  return 'ok';
end;
$$;

revoke all on function public.create_land(uuid, text, text, jsonb, integer, integer) from public, anon, authenticated;
revoke all on function public.save_land(uuid, integer, jsonb, integer, integer) from public, anon, authenticated;
revoke all on function public.save_raid(uuid, integer, jsonb, integer, uuid, integer, jsonb, integer)
  from public, anon, authenticated;
