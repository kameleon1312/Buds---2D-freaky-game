-- The premium shop: rides and weapons bought for gems (packages/shared premium.ts). Gems come only from verified
-- real-money purchases (public.purchases); the API grants them with grant_gems once a receipt is verified.
-- Written by the API (service role) only; clients never get policies.

-- Buys an item for gems: {"status": "ok", "gems": balance} | {"status": "owned"} | {"status": "poor", "gems": balance}.
-- The wallet row is locked first, so two parallel purchases can't spend the same gems.
create function public.buy_item_gems(p_bud uuid, p_item text, p_price integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  balance integer;
begin
  insert into public.bud_wallets (bud_id) values (p_bud) on conflict (bud_id) do nothing;
  select gems into balance from public.bud_wallets where bud_id = p_bud for update;
  if exists (select 1 from public.bud_items where bud_id = p_bud and item_id = p_item) then
    return jsonb_build_object('status', 'owned', 'gems', balance);
  end if;
  if balance < p_price then
    return jsonb_build_object('status', 'poor', 'gems', balance);
  end if;
  update public.bud_wallets set gems = gems - p_price, updated_at = now()
  where bud_id = p_bud returning gems into balance;
  insert into public.bud_items (bud_id, item_id, source) values (p_bud, p_item, 'purchase');
  return jsonb_build_object('status', 'ok', 'gems', balance);
end;
$$;

revoke all on function public.buy_item_gems(uuid, text, integer) from public, anon, authenticated;

-- Adds gems after a verified purchase. Returns the new balance.
create function public.grant_gems(p_bud uuid, p_gems integer)
returns integer
language sql
security invoker
set search_path = public
as $$
  insert into public.bud_wallets (bud_id, gems) values (p_bud, greatest(p_gems, 0))
  on conflict (bud_id) do update set gems = public.bud_wallets.gems + excluded.gems, updated_at = now()
  returning gems;
$$;

revoke all on function public.grant_gems(uuid, integer) from public, anon, authenticated;
