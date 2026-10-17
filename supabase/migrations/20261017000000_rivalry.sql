-- Rywalizacja (packages/shared/src/rivalry.ts, docs/rywalizacja.md): weekly influence over turfs (rewiry), the
-- daily tribute of their rulers, weekly challenges and titles, crews (ekipy), PvP ratings and the players' market
-- (Bazar). Everything is written by the API (service role) only; clients never get policies.

-- ---------- influence ----------

-- Influence per bud, turf and ISO week ("2026-W42"). updated_at breaks ties: who got there first rules.
create table public.rival_influence (
  bud_id uuid not null references public.buds (id) on delete cascade,
  turf_id text not null check (turf_id ~ '^[a-z0-9-]{2,40}$'),
  week text not null check (week ~ '^\d{4}-W\d{2}$'),
  points integer not null default 0 check (points >= 0),
  updated_at timestamptz not null default now(),
  primary key (bud_id, turf_id, week)
);

create index rival_influence_turf on public.rival_influence (turf_id, week, points desc, updated_at);
create index rival_influence_week on public.rival_influence (week);

alter table public.rival_influence enable row level security;

-- Influence earned per bud, turf and UTC day (the daily cap).
create table public.rival_influence_daily (
  bud_id uuid not null references public.buds (id) on delete cascade,
  turf_id text not null check (turf_id ~ '^[a-z0-9-]{2,40}$'),
  day date not null,
  points integer not null default 0 check (points >= 0),
  primary key (bud_id, turf_id, day)
);

alter table public.rival_influence_daily enable row level security;

-- Weekly challenge counts (wins, quests, caches, training rounds, PvP wins).
create table public.rival_counters (
  bud_id uuid not null references public.buds (id) on delete cascade,
  week text not null check (week ~ '^\d{4}-W\d{2}$'),
  challenge text not null check (challenge in ('zwyciestwa', 'zadania', 'skrytki', 'trening', 'pvp')),
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (bud_id, week, challenge)
);

create index rival_counters_week on public.rival_counters (week, challenge, count desc, updated_at);

alter table public.rival_counters enable row level security;

-- Tribute (haracz) collected by a turf's ruler, once per UTC day.
create table public.rival_tributes (
  bud_id uuid not null references public.buds (id) on delete cascade,
  turf_id text not null check (turf_id ~ '^[a-z0-9-]{2,40}$'),
  day date not null,
  coins integer not null check (coins >= 0),
  primary key (bud_id, turf_id, day)
);

alter table public.rival_tributes enable row level security;

-- Weeks whose winners got their titles and coins (settled once).
create table public.rival_weeks (
  week text primary key check (week ~ '^\d{4}-W\d{2}$'),
  settled_at timestamptz not null default now()
);

alter table public.rival_weeks enable row level security;

-- Titles kept for good: "turf:<turf id>" (ruled a turf at the end of the week) or "top:<1..3>" (week's ranking).
create table public.rival_titles (
  bud_id uuid not null references public.buds (id) on delete cascade,
  week text not null check (week ~ '^\d{4}-W\d{2}$'),
  title text not null check (title ~ '^(turf:[a-z0-9-]{2,40}|top:[1-3])$'),
  primary key (bud_id, week, title)
);

alter table public.rival_titles enable row level security;

-- Adds influence for something done in a turf, capped per day, and counts the week's challenge.
-- Returns {"gained": n, "total": n, "captured": bool} (captured = the bud rules the turf now and didn't before).
create function public.add_influence(
  p_bud uuid,
  p_turf text,
  p_week text,
  p_day date,
  p_points integer,
  p_cap integer,
  p_min integer,
  p_challenge text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  today integer;
  gained integer;
  total integer;
  owner_before uuid;
  owner_after uuid;
begin
  if p_challenge is not null then
    insert into public.rival_counters (bud_id, week, challenge, count) values (p_bud, p_week, p_challenge, 1)
    on conflict (bud_id, week, challenge)
    do update set count = public.rival_counters.count + 1, updated_at = now();
  end if;

  -- one writer per turf and week at a time, so "who rules" is decided in order
  perform pg_advisory_xact_lock(hashtext(p_turf || '/' || p_week));

  select bud_id into owner_before from public.rival_influence
  where turf_id = p_turf and week = p_week and points >= p_min
  order by points desc, updated_at asc limit 1;

  insert into public.rival_influence_daily (bud_id, turf_id, day, points) values (p_bud, p_turf, p_day, 0)
  on conflict (bud_id, turf_id, day) do nothing;
  select points into today from public.rival_influence_daily
  where bud_id = p_bud and turf_id = p_turf and day = p_day for update;
  gained := greatest(0, least(p_points, p_cap - today));

  if gained > 0 then
    update public.rival_influence_daily set points = points + gained
    where bud_id = p_bud and turf_id = p_turf and day = p_day;
    insert into public.rival_influence (bud_id, turf_id, week, points) values (p_bud, p_turf, p_week, gained)
    on conflict (bud_id, turf_id, week)
    do update set points = public.rival_influence.points + excluded.points, updated_at = now();
  end if;

  select coalesce(max(points), 0) into total from public.rival_influence
  where bud_id = p_bud and turf_id = p_turf and week = p_week;

  select bud_id into owner_after from public.rival_influence
  where turf_id = p_turf and week = p_week and points >= p_min
  order by points desc, updated_at asc limit 1;

  return jsonb_build_object(
    'gained', gained,
    'total', total,
    'captured', coalesce(owner_after = p_bud, false) and owner_before is distinct from p_bud
  );
end;
$$;

revoke all on function public.add_influence(uuid, text, text, date, integer, integer, integer, text)
  from public, anon, authenticated;

-- Counts a weekly challenge without influence (PvP wins).
create function public.bump_challenge(p_bud uuid, p_week text, p_challenge text)
returns integer
language sql
security invoker
set search_path = public
as $$
  insert into public.rival_counters (bud_id, week, challenge, count) values (p_bud, p_week, p_challenge, 1)
  on conflict (bud_id, week, challenge)
  do update set count = public.rival_counters.count + 1, updated_at = now()
  returning count;
$$;

revoke all on function public.bump_challenge(uuid, text, text) from public, anon, authenticated;

-- The turf's ruler collects today's tribute: coins to the wallet, once per day. Returns the new coin balance, or
-- null when the bud doesn't rule the turf or already collected today.
create function public.claim_tribute(
  p_bud uuid,
  p_turf text,
  p_week text,
  p_day date,
  p_coins integer,
  p_min integer
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid;
  balance integer;
begin
  select bud_id into owner from public.rival_influence
  where turf_id = p_turf and week = p_week and points >= p_min
  order by points desc, updated_at asc limit 1;
  if owner is distinct from p_bud then
    return null;
  end if;
  insert into public.rival_tributes (bud_id, turf_id, day, coins) values (p_bud, p_turf, p_day, p_coins)
  on conflict (bud_id, turf_id, day) do nothing;
  if not found then
    return null;
  end if;
  insert into public.bud_wallets (bud_id, coins) values (p_bud, p_coins)
  on conflict (bud_id) do update set coins = public.bud_wallets.coins + excluded.coins, updated_at = now()
  returning coins into balance;
  return balance;
end;
$$;

revoke all on function public.claim_tribute(uuid, text, text, date, integer, integer)
  from public, anon, authenticated;

-- Settles a finished week once: every turf's ruler gets "turf:<id>" and p_turf_coins, the week's top three by total
-- influence get "top:<n>" and p_top_coins[n]. Returns false when the week was already settled.
create function public.settle_week(p_week text, p_min integer, p_turf_coins integer, p_top_coins integer[])
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  w record;
  n integer := 0;
begin
  insert into public.rival_weeks (week) values (p_week) on conflict (week) do nothing;
  if not found then
    return false;
  end if;

  for w in
    select distinct on (turf_id) turf_id, bud_id from public.rival_influence
    where week = p_week and points >= p_min
    order by turf_id, points desc, updated_at asc
  loop
    insert into public.rival_titles (bud_id, week, title) values (w.bud_id, p_week, 'turf:' || w.turf_id)
    on conflict do nothing;
    insert into public.bud_wallets (bud_id, coins) values (w.bud_id, p_turf_coins)
    on conflict (bud_id) do update set coins = public.bud_wallets.coins + excluded.coins, updated_at = now();
  end loop;

  for w in
    select bud_id, sum(points) as total, max(updated_at) as last from public.rival_influence
    where week = p_week group by bud_id having sum(points) > 0
    order by total desc, last asc limit 3
  loop
    n := n + 1;
    insert into public.rival_titles (bud_id, week, title) values (w.bud_id, p_week, 'top:' || n)
    on conflict do nothing;
    insert into public.bud_wallets (bud_id, coins) values (w.bud_id, p_top_coins[n])
    on conflict (bud_id) do update set coins = public.bud_wallets.coins + excluded.coins, updated_at = now();
  end loop;
  return true;
end;
$$;

revoke all on function public.settle_week(text, integer, integer, integer[]) from public, anon, authenticated;

-- ---------- crews (ekipy) ----------

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 20),
  tag text not null check (tag ~ '^[A-Z0-9]{2,4}$'),
  created_at timestamptz not null default now()
);

create unique index crews_name on public.crews (lower(name));
create unique index crews_tag on public.crews (tag);

alter table public.crews enable row level security;

-- One crew per bud.
create table public.crew_members (
  bud_id uuid primary key references public.buds (id) on delete cascade,
  crew_id uuid not null references public.crews (id) on delete cascade,
  role text not null check (role in ('leader', 'member')),
  joined_at timestamptz not null default now()
);

create index crew_members_crew on public.crew_members (crew_id, joined_at);

alter table public.crew_members enable row level security;

-- Founds a crew with the bud as its leader: "ok" | "in_crew" | "taken" (name or tag in use).
create function public.create_crew(p_bud uuid, p_name text, p_tag text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  crew uuid;
begin
  if exists (select 1 from public.crew_members where bud_id = p_bud) then
    return 'in_crew';
  end if;
  begin
    insert into public.crews (name, tag) values (p_name, p_tag) returning id into crew;
  exception when unique_violation then
    return 'taken';
  end;
  insert into public.crew_members (bud_id, crew_id, role) values (p_bud, crew, 'leader');
  return 'ok';
end;
$$;

revoke all on function public.create_crew(uuid, text, text) from public, anon, authenticated;

-- Joins a crew by tag: "ok" | "in_crew" | "full" | "unknown".
create function public.join_crew(p_bud uuid, p_tag text, p_max integer)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  crew uuid;
  members integer;
begin
  select id into crew from public.crews where tag = p_tag for update;
  if crew is null then
    return 'unknown';
  end if;
  if exists (select 1 from public.crew_members where bud_id = p_bud) then
    return 'in_crew';
  end if;
  select count(*) into members from public.crew_members where crew_id = crew;
  if members >= p_max then
    return 'full';
  end if;
  insert into public.crew_members (bud_id, crew_id, role) values (p_bud, crew, 'member');
  return 'ok';
end;
$$;

revoke all on function public.join_crew(uuid, text, integer) from public, anon, authenticated;

-- Leaves the crew; a leaving leader hands over to the longest-serving member, the last one out closes the crew.
-- Returns false when the bud wasn't in a crew.
create function public.leave_crew(p_bud uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  crew uuid;
  was text;
  heir uuid;
begin
  select crew_id, role into crew, was from public.crew_members where bud_id = p_bud;
  if crew is null then
    return false;
  end if;
  perform 1 from public.crews where id = crew for update;
  delete from public.crew_members where bud_id = p_bud;
  select bud_id into heir from public.crew_members where crew_id = crew order by joined_at asc limit 1;
  if heir is null then
    delete from public.crews where id = crew;
  elsif was = 'leader' then
    update public.crew_members set role = 'leader' where bud_id = heir;
  end if;
  return true;
end;
$$;

revoke all on function public.leave_crew(uuid) from public, anon, authenticated;

-- ---------- PvP ----------

create table public.pvp_ratings (
  bud_id uuid primary key references public.buds (id) on delete cascade,
  rating integer not null default 1000,
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  updated_at timestamptz not null default now()
);

create index pvp_ratings_rating on public.pvp_ratings (rating desc);

alter table public.pvp_ratings enable row level security;

-- When a bud last challenged another (rematch cooldown) and how many paid wins it had per day.
create table public.pvp_challenges (
  bud_id uuid not null references public.buds (id) on delete cascade,
  opponent_id uuid not null references public.buds (id) on delete cascade,
  last_at timestamptz not null default now(),
  primary key (bud_id, opponent_id)
);

alter table public.pvp_challenges enable row level security;

create table public.pvp_daily (
  bud_id uuid not null references public.buds (id) on delete cascade,
  day date not null,
  wins integer not null default 0 check (wins >= 0),
  primary key (bud_id, day)
);

alter table public.pvp_daily enable row level security;

-- Records a challenge if the cooldown has passed: true = go, false = still cooling down.
create function public.pvp_challenge(p_bud uuid, p_opponent uuid, p_cooldown integer)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.pvp_challenges (bud_id, opponent_id, last_at) values (p_bud, p_opponent, now())
  on conflict (bud_id, opponent_id) do update set last_at = now()
  where public.pvp_challenges.last_at <= now() - make_interval(secs => p_cooldown);
  return found;
end;
$$;

revoke all on function public.pvp_challenge(uuid, uuid, integer) from public, anon, authenticated;

-- The challenger won: it gains p_delta rating, the defender loses it (never below 0). The day's first p_paid wins pay
-- p_coins into the winner's wallet. Returns {"rating": winner's new rating, "winsToday": n, "paid": coins paid,
-- "coins": winner's balance}.
create function public.pvp_result(
  p_winner uuid,
  p_loser uuid,
  p_delta integer,
  p_day date,
  p_coins integer,
  p_paid integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  r integer;
  today integer;
  paid integer := 0;
  balance integer;
begin
  insert into public.pvp_ratings (bud_id) values (p_winner), (p_loser) on conflict (bud_id) do nothing;
  update public.pvp_ratings set rating = rating + p_delta, wins = wins + 1, updated_at = now()
  where bud_id = p_winner returning rating into r;
  update public.pvp_ratings set rating = greatest(0, rating - p_delta), losses = losses + 1, updated_at = now()
  where bud_id = p_loser;
  insert into public.pvp_daily (bud_id, day, wins) values (p_winner, p_day, 1)
  on conflict (bud_id, day) do update set wins = public.pvp_daily.wins + 1
  returning wins into today;
  if today <= p_paid then
    paid := greatest(0, p_coins);
  end if;
  insert into public.bud_wallets (bud_id, coins) values (p_winner, paid)
  on conflict (bud_id) do update set coins = public.bud_wallets.coins + excluded.coins, updated_at = now()
  returning coins into balance;
  return jsonb_build_object('rating', r, 'winsToday', today, 'paid', paid, 'coins', balance);
end;
$$;

revoke all on function public.pvp_result(uuid, uuid, integer, date, integer, integer)
  from public, anon, authenticated;

-- A lost PvP duel: the challenger loses p_delta rating, the defender gains it.
create function public.pvp_loss(p_loser uuid, p_winner uuid, p_delta integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  r integer;
begin
  insert into public.pvp_ratings (bud_id) values (p_winner), (p_loser) on conflict (bud_id) do nothing;
  update public.pvp_ratings set rating = rating + p_delta, wins = wins + 1, updated_at = now()
  where bud_id = p_winner;
  update public.pvp_ratings set rating = greatest(0, rating - p_delta), losses = losses + 1, updated_at = now()
  where bud_id = p_loser returning rating into r;
  return r;
end;
$$;

revoke all on function public.pvp_loss(uuid, uuid, integer) from public, anon, authenticated;

-- ---------- market (Bazar) ----------

alter table public.bud_items drop constraint bud_items_source_check;
alter table public.bud_items
  add constraint bud_items_source_check
  check (source in ('reward', 'shop', 'purchase', 'gift', 'promo', 'trade'));

create table public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.buds (id) on delete cascade,
  item_id text not null check (item_id ~ '^[a-z0-9-]{3,40}$'),
  -- where the seller got it, restored if the listing is taken back
  source text not null,
  price integer not null check (price between 5 and 5000),
  created_at timestamptz not null default now(),
  buyer_id uuid references public.buds (id) on delete set null,
  sold_at timestamptz
);

create index market_listings_open on public.market_listings (created_at desc) where sold_at is null;
create index market_listings_seller on public.market_listings (seller_id) where sold_at is null;

alter table public.market_listings enable row level security;

-- Puts an owned, unworn item up for sale: it leaves the seller's items while listed.
-- Returns {"status": "ok", "id": uuid} | {"status": "not_owned" | "worn" | "too_many"}.
create function public.market_list(p_bud uuid, p_item text, p_price integer, p_max integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  src text;
  listing uuid;
begin
  select source into src from public.bud_items where bud_id = p_bud and item_id = p_item for update;
  if src is null then
    return jsonb_build_object('status', 'not_owned');
  end if;
  if exists (select 1 from public.bud_equipment where bud_id = p_bud and item_id = p_item) then
    return jsonb_build_object('status', 'worn');
  end if;
  if (select count(*) from public.market_listings where seller_id = p_bud and sold_at is null) >= p_max then
    return jsonb_build_object('status', 'too_many');
  end if;
  delete from public.bud_items where bud_id = p_bud and item_id = p_item;
  insert into public.market_listings (seller_id, item_id, source, price) values (p_bud, p_item, src, p_price)
  returning id into listing;
  return jsonb_build_object('status', 'ok', 'id', listing);
end;
$$;

revoke all on function public.market_list(uuid, text, integer, integer) from public, anon, authenticated;

-- Takes an unsold listing back: the item returns to the seller. False when it isn't theirs or already sold.
create function public.market_cancel(p_bud uuid, p_listing uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  l record;
begin
  select * into l from public.market_listings
  where id = p_listing and seller_id = p_bud and sold_at is null for update;
  if not found then
    return false;
  end if;
  delete from public.market_listings where id = p_listing;
  insert into public.bud_items (bud_id, item_id, source) values (p_bud, l.item_id, l.source)
  on conflict (bud_id, item_id) do nothing;
  return true;
end;
$$;

revoke all on function public.market_cancel(uuid, uuid) from public, anon, authenticated;

-- Buys a listing: the buyer pays the price, the seller gets it minus the market's fee, the item moves.
-- Returns {"status": "ok", "coins": buyer's balance} | {"status": "gone" | "own" | "owned" | "poor", "coins": n}.
create function public.market_buy(p_bud uuid, p_listing uuid, p_fee integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  l record;
  balance integer;
begin
  select * into l from public.market_listings where id = p_listing and sold_at is null for update;
  insert into public.bud_wallets (bud_id) values (p_bud) on conflict (bud_id) do nothing;
  select coins into balance from public.bud_wallets where bud_id = p_bud for update;
  if not found or l.id is null then
    return jsonb_build_object('status', 'gone', 'coins', balance);
  end if;
  if l.seller_id = p_bud then
    return jsonb_build_object('status', 'own', 'coins', balance);
  end if;
  if exists (select 1 from public.bud_items where bud_id = p_bud and item_id = l.item_id) then
    return jsonb_build_object('status', 'owned', 'coins', balance);
  end if;
  if balance < l.price then
    return jsonb_build_object('status', 'poor', 'coins', balance);
  end if;
  update public.bud_wallets set coins = coins - l.price, updated_at = now()
  where bud_id = p_bud returning coins into balance;
  insert into public.bud_wallets (bud_id, coins) values (l.seller_id, l.price - p_fee)
  on conflict (bud_id) do update set coins = public.bud_wallets.coins + excluded.coins, updated_at = now();
  insert into public.bud_items (bud_id, item_id, source) values (p_bud, l.item_id, 'trade');
  update public.market_listings set buyer_id = p_bud, sold_at = now() where id = p_listing;
  return jsonb_build_object('status', 'ok', 'coins', balance);
end;
$$;

revoke all on function public.market_buy(uuid, uuid, integer) from public, anon, authenticated;

-- ---------- reads (aggregations PostgREST can't express) ----------

-- Buds by total influence in a week, best first (ties: who got there first).
create function public.rival_week_totals(p_week text, p_limit integer)
returns table (slug text, name text, xp integer, points bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select b.slug, b.name, b.xp, sum(i.points) as points
  from public.rival_influence i join public.buds b on b.id = i.bud_id
  where i.week = p_week
  group by b.id
  having sum(i.points) > 0
  order by points desc, max(i.updated_at) asc
  limit p_limit;
$$;

revoke all on function public.rival_week_totals(text, integer) from public, anon, authenticated;

-- A bud's total influence in a week and its place (rank null without points).
create function public.rival_week_standing(p_bud uuid, p_week text)
returns table (points bigint, rank bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with t as (
    select bud_id, sum(points) as points, max(updated_at) as last
    from public.rival_influence where week = p_week group by bud_id having sum(points) > 0
  ), r as (
    select bud_id, points, row_number() over (order by points desc, last asc) as rank from t
  )
  select coalesce((select points from r where bud_id = p_bud), 0),
         (select rank from r where bud_id = p_bud);
$$;

revoke all on function public.rival_week_standing(uuid, text) from public, anon, authenticated;

-- The bud's count and place in every challenge it took part in this week.
create function public.rival_challenge_standing(p_bud uuid, p_week text)
returns table (challenge text, count integer, rank bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select challenge, count, rank from (
    select bud_id, challenge, count,
           row_number() over (partition by challenge order by count desc, updated_at asc) as rank
    from public.rival_counters where week = p_week and count > 0
  ) r where bud_id = p_bud;
$$;

revoke all on function public.rival_challenge_standing(uuid, text) from public, anon, authenticated;

-- Crews with their member counts: room first is the API's job; here by size, then age.
create function public.crew_list(p_limit integer)
returns table (tag text, name text, members bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select c.tag, c.name, count(m.bud_id) as members
  from public.crews c left join public.crew_members m on m.crew_id = c.id
  group by c.id
  order by members desc, c.created_at asc
  limit p_limit;
$$;

revoke all on function public.crew_list(integer) from public, anon, authenticated;

-- Crews by their members' influence in a week.
create function public.crew_week_totals(p_week text, p_limit integer)
returns table (tag text, name text, points bigint, members bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select * from (
    select c.tag, c.name,
           coalesce((select sum(i.points) from public.rival_influence i
                     join public.crew_members m on m.bud_id = i.bud_id
                     where m.crew_id = c.id and i.week = p_week), 0) as points,
           (select count(*) from public.crew_members m where m.crew_id = c.id) as members
    from public.crews c
  ) t
  where t.points > 0
  order by t.points desc, t.tag asc
  limit p_limit;
$$;

revoke all on function public.crew_week_totals(text, integer) from public, anon, authenticated;
