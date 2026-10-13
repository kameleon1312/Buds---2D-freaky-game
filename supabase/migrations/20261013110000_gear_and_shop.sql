-- Gear and the coin shop. Everything is written by the API (service role) only; clients never get policies.

-- What a bud wears, one item per slot (packages/shared gear.ts). The API checks ownership and the slot.
create table public.bud_equipment (
  bud_id uuid not null references public.buds (id) on delete cascade,
  slot text not null check (slot in ('head', 'face', 'torso', 'hands', 'legs', 'feet', 'accessory', 'held')),
  item_id text not null check (item_id ~ '^[a-z0-9-]{3,40}$'),
  equipped_at timestamptz not null default now(),
  primary key (bud_id, slot)
);

alter table public.bud_equipment enable row level security;

-- Items bought for in-game coins get their own source.
alter table public.bud_items drop constraint bud_items_source_check;
alter table public.bud_items
  add constraint bud_items_source_check check (source in ('reward', 'shop', 'purchase', 'gift', 'promo'));

-- Buys an item for coins: {"status": "ok", "coins": balance} | {"status": "owned"} | {"status": "poor", "coins": balance}.
-- The wallet row is locked first, so two parallel purchases can't spend the same coins.
create function public.buy_item(p_bud uuid, p_item text, p_price integer)
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
  if exists (select 1 from public.bud_items where bud_id = p_bud and item_id = p_item) then
    return jsonb_build_object('status', 'owned', 'coins', balance);
  end if;
  if balance < p_price then
    return jsonb_build_object('status', 'poor', 'coins', balance);
  end if;
  update public.bud_wallets set coins = coins - p_price, updated_at = now()
  where bud_id = p_bud returning coins into balance;
  insert into public.bud_items (bud_id, item_id, source) values (p_bud, p_item, 'shop');
  return jsonb_build_object('status', 'ok', 'coins', balance);
end;
$$;

revoke all on function public.buy_item(uuid, text, integer) from public, anon, authenticated;

-- Accounts: a user's buds are looked up by user_id (set when a bud is created while signed in, or claimed).
create index buds_user_idx on public.buds (user_id) where user_id is not null;
